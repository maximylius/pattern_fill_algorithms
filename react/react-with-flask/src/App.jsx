import { useState, useEffect, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.draw.js';

function App() {
  // --- ORIGINAL STATE (Timer & Counter) ---
  const [count, setCount] = useState(0)
  const [nextShapeId, setNextShapeId] = useState(0)
  const [currentTime, setCurrentTime] = useState(0);
  // const useShapeId = () => { setNextShapeId(nextShapeId + 1); return nextShapeId; };
  const [hoveredShapeId, setHoveredShapeId] = useState(-1)
  // --- DRAWING STATE ---
  const drawingAreaRef = useRef(null);
  const drawInstance = useRef(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [shapes, setShapes] = useState({}); // Liste: { id: number, instance: SVGObject, fillColor: string }
  const [hoveredId, setHoveredId] = useState(null);
  const [redoStack, setRedoStack] = useState([]); // Speicher für rückgängig gemachte Formen

  // API Call (Flask)
  useEffect(() => {
    fetch('/api/time').then(res => res.json()).then(data => {
      setCurrentTime(data.time);
    });
  }, [count]);
  const addHoverListeners = (shape, newShapeId) => {
    shape.on('mouseenter', () => setHoveredShapeId(newShapeId));
    shape.on('mouseleave', () => setHoveredShapeId(-1));
  };

  const finishShape = (shape, shapeType) => {
    if (!shape) return;

    if (typeof shape.draw === 'function') {
      shape.draw('done');
      shape.draw('stop');
    }

    // Wir nutzen einen Zeitstempel oder eine Zufallszahl als ID, 
    // um asynchrone State-Konflikte zu vermeiden.
    const currentId = Date.now().toString(); 

    setShapes(prev => ({ 
      ...prev, 
      [currentId]: { 
        id: currentId, 
        instance: shape, 
        fillColor: shape.fillColor || (shapeType === "freehand" ? '#ff0066' : '#007bff') 
      } 
    }));
    console.log("currentId:", currentId);
    addHoverListeners(shape, currentId);
    setCurrentShape(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && currentShape) {
      // 1. Aktuelles abschließen
      finishShape( "clickedPolygon");
      // 2. SOFORT ein neues starten (Auto-Reaktivierung)
      const nextPoly = drawInstance.current.polygon()
        .fill({ color: '#ff0066', opacity: 0.4 })
        .stroke({ width: 2, color: '#333' });
      
      nextPoly.draw();
      nextPoly.fillColor = '#ff0066';
      setCurrentShape(nextPoly); 
    }
  };
  // Initialisierung & Enter-Key Listener
  useEffect(() => {
    if (drawingAreaRef.current && !drawInstance.current) {
      drawInstance.current = SVG().addTo(drawingAreaRef.current).size('100%', '100%');
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentShape]);

  // Highlighting Logik
  useEffect(() => {
    Object.entries(shapes).forEach(([shapeId, shape]) => {
      if (shape.instance) {
        try {
          if (shape.id === hoveredShapeId) {
            shape.instance.stroke({ color: '#ffec00', width: 4 });
            shape.instance.fill({ color: shape.fillColor, opacity: 1 });
          } else {
            shape.instance.stroke({ color: '#333', width: 2 });
            shape.instance.fill({ color: shape.fillColor, opacity: 0.4 });
          }
        } catch (err) {
          console.warn("Konnte Stroke nicht anwenden für Shape:", shape.id);
        }
      }
    });
  }, [hoveredShapeId, shapes]);
  // --- ACTIONS ---
  const startClickPolygon = () => {
    setRedoStack([]); // Redo-Verlauf löschen bei neuer Aktion
    const poly = drawInstance.current.polygon().fill('#ff0066').opacity(0.4).stroke({ width: 2, color: '#333' });
    poly.draw();
    poly.fillColor = '#ff0066';
    setCurrentShape(poly);
  };
  
  const stopDrawing = () => {
    if (currentShape) {
      currentShape.draw('stop'); // Stoppt svg.draw.js
      setCurrentShape(null);
    }
    drawingAreaRef.current.onmousedown = null;
    drawingAreaRef.current.onmousemove = null;
    drawingAreaRef.current.onmouseup = null;
  };

  const startHoldPolygon = () => {
    stopDrawing(); // Vorherige Handler säubern
    setRedoStack([]);

    let poly = null;
    let points = [];

    const getCoords = (e) => {
      const rect = drawingAreaRef.current.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    drawingAreaRef.current.onmousedown = (e) => {
      points = [getCoords(e)];
      poly = drawInstance.current.polygon(points)
        .fill({ color: '#007bff', opacity: 0.3 })
        .stroke({ width: 2, color: '#007bff' });
      poly.fillColor = '#007bff';
    };

    drawingAreaRef.current.onmousemove = (e) => {
      if (!poly) return;
      points.push(getCoords(e));
      poly.plot(points);
    };

    drawingAreaRef.current.onmouseup = () => {
      if (poly) {
        finishShape(poly, "freehand");
        poly = null;
        points = [];
      }
    };
  };

  const deleteShape = (id) => {
    // 1. Highlight zurücksetzen, falls das gelöschte Objekt markiert war
    if (hoveredShapeId === id) setHoveredId(null);

    // 2. Direktzugriff über die ID (Dictionary-Style)
    const shapeInstance = shapes[id];

    if (shapeInstance) {

      // 3. State aktualisieren (Dictionary-Eintrag löschen)
      setShapes(prev => {
        const { [id]: deletedItem, ...remainingShapes } = prev;
        return remainingShapes;
      });
      // Aus dem SVG-DOM entfernen
      shapeInstance.remove();

      // Redo-Stack leeren, da Referenzen ungültig werden
      setRedoStack([]);
    }
  };

  const rotateAll = () => {
    Object.entries(shapes).forEach(([shapeId, shape]) => {
      const r = (shape.instance.transform().rotate || 0) + 45;
      shape.instance.animate(300).transform({ rotate: r });
    });
  };

  const clearAll = () => {
    setHoveredId(null);
    drawInstance.current.clear();
    setShapes({});
    setCurrentShape(null);
  };


  // UNDO: Letztes Element verstecken und in den Redo-Stack schieben
  const undoLast = () => {
    if (shapes.length === 0) return;
    
    const { [Object.keys(shapes).reduce((a, b) => Math.max(a, b))]: deletedItem, ...remainingShapes } = shapes;
    lastShape.instance.hide(); // Aus dem Sichtfeld entfernen
    setRedoStack(prev => [...prev, lastShape]);
    setShapes(prev => prev.slice(0, -1));
  };

  // REDO: Letztes Element aus dem Redo-Stack wieder anzeigen
  const redoLast = () => {
    if (redoStack.length === 0) return;
    
    const shapeToRestore = redoStack[redoStack.length - 1];
    shapeToRestore.instance.show(); // Wieder sichtbar machen
    
    setShapes(prev => [...prev, shapeToRestore]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  return (
    <>
      <div className="header-logos">
        <a href="https://vite.dev" target="_blank"><img src={viteLogo} className="logo" alt="Vite logo" /></a>
        <a href="https://react.dev" target="_blank"><img src={reactLogo} className="logo react" alt="React logo" /></a>
      </div>

      <div className="card">
        <button onClick={() => setCount(c => c + 1)}>Count is {count}</button>
        <p>Flask Time: {currentTime ? new Date(currentTime * 1000).toLocaleString() : '...'}</p>
      </div>

      <div className="editor-container" style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
        
       {/* LEFT PANEL */}
      <div className="panel tools">
        <h4>Tools</h4>
        <button onClick={startClickPolygon}>Polygon (Click)</button>
        <button onClick={startHoldPolygon}>Polyline (Hold)</button>
        
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={undoLast} disabled={shapes.length === 0}>Undo</button>
          <button onClick={redoLast} disabled={redoStack.length === 0}>Redo</button>
        </div>

        <button onClick={rotateAll}>Rotate All</button>
        <button onClick={clearAll} style={{ color: 'red' }}>Clear All</button>
      </div>

        {/* CANVAS */}
        <div ref={drawingAreaRef} style={{ 
          width: '600px', height: '400px', border: '2px solid #646cff', 
          backgroundColor: 'white', position: 'relative', overflow: 'hidden' 
        }}></div>

        {/* RIGHT PANEL */}
        <div className="panel list" style={{ width: '200px', textAlign: 'left' }}>
          <h4>Shapes</h4>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {
              Object.entries(shapes).forEach(([shapeId, shape]) => (
                <div key={shape.id} 
                  onMouseEnter={() => setHoveredId(shape.id)} 
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', padding: '5px',
                    borderBottom: '1px solid #444', backgroundColor: hoveredShapeId === shape.id ? '#333' : 'transparent'
                  }}
                >
                  <span>#{shape.id + 1} {shape.instance?.type ? shape.instance.type : 'Shape'}</span>
                  <button onClick={() => deleteShape(shape.id)} style={{ padding: '0 5px', background: 'none', color: 'red', border: 'none' }}>✖</button>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </>
  )
}

export default App

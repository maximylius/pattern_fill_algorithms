import { useState, useEffect, useRef, useMemo } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.draw.js';
import { Button, Navbar, Nav, NavDropdown, Container, ListGroup, Stack, Badge, Row, Col, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Für Dropdowns, Modals etc.
import SvgGrid from './svg_grid.jsx';
import SvgPoints from './svg_points.jsx';

//  TODO: make functions accept the creation and deletion of multiple shapes at once for better undo/redo performance
function P_Shapes() {
    // --- ORIGINAL STATE (Timer & Counter) ---
    const selectedPtsRef = useRef(null);
    const [nextShapeId, setNextShapeId] = useState(0)
    const [selectedShapeIds, setSelectedShapeIds] = useState([]);
    const [selectedVertices, setSelectedVertices] = useState([]);
    const [hoveredShapeId, setHoveredShapeId] = useState(-1)
    const drawingAreaRef = useRef(null);
    const drawInstance = useRef(null);
    const [currentShape, setCurrentShape] = useState(null);
    const [shapes, setShapes] = useState({}); // Liste: { id: number, shapeInstance: SVGObject, fillColor: string }
    const [undoStack, setUndoStack] = useState([]); // Speicher für rückgängig gemachte Formen
    const [redoStack, setRedoStack] = useState([]); // Speicher für rückgängig gemachte Formen
    const [shapeType, setShapeType] = useState("freehand"); // "click-poly", "freehand", "c-rect-select", "freehand-select"
    const [selectVertices, setSelectVertices] = useState(true); // Speicher für rückgängig gemachte Formen
    const [showGrid, setShowGrid] = useState(true); // Speicher für rückgängig gemachte Formen
    const [svgIsReady, setSvgIsReady] = useState(false);
    const [currentTool, setCurrentTool] = useState("click-poly"); // 'select', 'rectangle', 'freehand', 'click-poly'
    const shapeInstanceRef = useRef(currentShape); // Ref für die aktuelle Form, die gezeichnet wird
    const draggingPoints = {current:false}
    const sendSvgToBackend = async (shapeObjArr) => {
        const shapesToSend = [];
        shapeObjArr.forEach( ({shapeInstance, shapeClass, id}) => {
            const points = [];
            for (let point of shapeInstance.node.points){
                points.push([point.x, point.y]);
            }
            shapesToSend.push({points:points, type: shapeClass, id: id});
        })
        console.log("Sending shapes to backend:", shapesToSend);
        try {
            const response = await fetch('/api/process-shapes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    operation: 'CREATE_SHAPES',
                    shapes: shapesToSend,
                }),
            });
            const data = await response.json();
        } catch (error) {
            console.error('Fehler beim Senden:', error);
        }
    };

    const deleteSvgsFromBackend = async (shapeIds) => {
        try {
            const response = await fetch('/api/delete-shapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ids: shapeIds,
                operation: 'DELETE_SHAPES',
            }),
            });
            const data = await response.json();
            console.log('Del response:', data);
        } catch (error) {
            console.error('Fehler beim Senden:', error);
        }
    };

    const selectShapesFromBackend = async (e, shapeInstance) => {
        const points = [];
        for (let point of shapeInstance.node.points){
            points.push([point.x, point.y]);
        }
        try {
            const response = await fetch('/api/select-shapes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                operation: 'SELECT_SHAPES',
                selectVertices: selectVertices,
                points: points,
            }),
            });
            const data = await response.json();
            let selectedShapeIdPoints = data.selectedShapeIdPoints.map(([shapeId,pts])=>[shapeId,pts,shapes[shapeId]?.shapeInstance?._array?.map((xy,n)=>pts.some(ptxy => JSON.stringify(ptxy)===JSON.stringify(xy)) ? n : -1).filter(el => el !== -1) || []]) 
            console.log("settin-1:",selectedShapeIdPoints)
            selectShapes(e, selectedShapeIdPoints);
        } catch (error) {
            console.error('Fehler beim Senden:', error);
        }
    };

    const selectShapes = (e, selectedShapeIdPoints) => {
        e.preventDefault();
        if (!Array.isArray(selectedShapeIdPoints)) {
            console.warn("selectShapes erwartet ein Array von IDs, erhielt stattdessen:", selectedShapeIdPoints);
            return
        } 

        setSelectedShapeIds(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
            const prevIds = prevArr.map(([id, pts, ptids]) => id); // Falls prev als Array von Objekten vorliegt, extrahiere die IDs
            const newIds = selectedShapeIdPoints.map(([id, pts, ptids]) => id);
            if (e?.ctrlKey) {
                // toggle selection when Ctrl is held
                return [...prevArr.filter(([id,pts, ptids]) => !newIds.includes(id)), ...selectedShapeIdPoints.filter(([id,pts, ptids]) => !prevIds.includes(id))];
            }
            console.log("setting:0",selectedShapeIdPoints)
            return selectedShapeIdPoints;
        });
        setSelectedVertices(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
        });
    };

    const pushAction = (type, data) => {
        setUndoStack(prev => [...prev, { type, data }]);
        setRedoStack([]); // Wichtig: Redo-Verlauf wird bei neuer Aktion ungültig
    };

    const cleanRedoStack = () => {
        for (let action of redoStack) {
            if (action.type === "CREATE_SHAPES") {
                const idsToDelete = [];
                for (let {shapeInstance, id} of action.data) {
                    shapeObj.shapeInstance.remove();
                    idsToDelete.push(id);
                }   
                deleteSvgsFromBackend(idsToDelete);
            }
        }
        setRedoStack([])
    };

    const addHoverListeners = (shape, newShapeId) => {
        shape.on('mouseenter', (e) => setHoveredShapeId(newShapeId));
        shape.on('mouseleave', (e) => setHoveredShapeId(-1));
        shape.on('click', (e) => {
            console.log("Shape clicked:", newShapeId, e.ctrlKey);
            selectShapes(e, [[newShapeId,[],[]]])
        });
    };

    const createShapes = (e, shapeObjArr, originType=['action','undo','redo'][0]) => {
        if (shapeObjArr.length === 0) return;
        if (shapeObjArr.length > 1 || !shapeObjArr[0].shapeClass.includes('selection')) {
            if (originType === 'action'){
                cleanRedoStack();
            }
            setShapes(prev => { 
                const updatedShapes = {...prev}; 
                const shapesToSend = [];
                for (let {shapeInstance, shapeClass, id} of shapeObjArr) {
                    if (!shapeInstance) return;
                    if (typeof shapeInstance.draw === 'function') {
                        shapeInstance.draw('done');
                        shapeInstance.draw('stop');
                    }
                    let currentId = id === '' ? Date.now().toString() : id;
                    shapesToSend.push({shapeInstance, shapeClass, id: currentId});
                    updatedShapes[currentId] = { 
                        id: currentId, 
                        shapeClass: shapeClass,
                        shapeInstance: shapeInstance, 
                    }
                    if (originType === 'action') {
                        addHoverListeners(shapeInstance, currentId);
                    } else {
                        shapeInstance.show();
                    }
                }
                // console.log("initialize send to backend", shapeObjArr, originType)
                sendSvgToBackend(shapesToSend);

                return updatedShapes;
            });
            
            if (originType === 'action') {
                pushAction("CREATE_SHAPES", {shapeObjArr});
            }
            setCurrentShape(null);
        } else {
            const {shapeInstance, shapeClass} = shapeObjArr[0];
            if (typeof shapeInstance.draw === 'function') {
                shapeInstance.draw('done');
                shapeInstance.draw('stop');
            }
            // Selection Shapes werden nicht gespeichert
            selectShapesFromBackend(e, shapeInstance);
            // console.log("Selection shape created, not storing:", shapeInstance, shapeClass);
            shapeInstance.animate(300).opacity(0).after(() => shapeInstance.remove());
        }

    };

    const stopDrawing = (shapeInstance2) => {
        let shapeInstance = shapeInstanceRef.current
        console.warn("Stopping drawing for shapeInstance:", shapeInstance);
        if (shapeInstance) {
            console.log("Stopping shape drawing:", shapeInstance);
            shapeInstance.draw('done'); // Stoppt svg.draw.js
            shapeInstance.draw('stop'); // Stoppt svg.draw.js
            shapeInstance.remove();
            setCurrentShape(null);
        }
        // drawingAreaRef.current.onmousedown = null;
        // drawingAreaRef.current.onmousemove = null;
        // drawingAreaRef.current.onmouseup = null;
    };
    // Initialisierung & Enter-Key Listener
    useEffect(() => {
        if (drawingAreaRef.current && !drawInstance.current) {
            drawInstance.current = SVG().addTo(drawingAreaRef.current).size('100%', '100%');
            // drawInstance.current.fill(showGrid ? '#f0f0f0' : '#ffffff');
            setSvgIsReady(true);
        }
    }, []);

    useEffect(() => {
        // if (drawingAreaRef.current && !drawInstance.current) {
        //     drawInstance.current = SVG().addTo(drawingAreaRef.current).size('100%', '100%');
        //     drawInstance.current.fill(showGrid ? '#f0f0f0' : '#ffffff');
        // }
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && currentShape) {
                // 1. Aktuelles abschließen
                console.log("Finalizing shape on Enter key:", currentShape?.node?.points?.length, currentShape?.node?.classList?.contains('click-poly'));
                // const currentPoly = drawInstance.current.polygon()
                // createShape(currentPoly, "click-poly");
                createShapes(e,[{shapeInstance: currentShape, shapeClass: "click-poly", id: ''}]);
                // 2. SOFORT ein neues starten (Auto-Reaktivierung)
                const nextPoly = drawInstance.current.polygon()
                nextPoly.node.classList.add('click-poly');
                // nextPoly.draw();
                setCurrentShape(nextPoly); 
            } else if (e.key === 'Delete') {
                console.log("Pressed delete key", selectVertices)
                if (selectVertices){
                    deleteVertices(selectedShapeIds, 'action')
                } else {
                    deleteShapes(selectedShapeIds.map(([id,pts,ptids]) => id), 'action');
                }
            } else if (e.key === 'Escape') {
                console.log("Cancelling shape on Escape key");
                stopDrawing(currentShape);
            } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
                console.log("Undo triggered by Ctrl+Z");
                undoLast(e);
            } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
                console.log("Redo triggered by Ctrl+Y");
                redoLast(e);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentShape, selectedShapeIds]);

    useEffect(() => {
        // if (drawInstance.current) {
        //     console.log("ShowGrid;drawInstance.current", drawInstance.current, drawInstance.current.node );
        //     // drawInstance.current.fill(showGrid ? '#ca3636' : '#ffffff');
        // }
        if (showGrid) {
            drawInstance.current.fill('url(#js-grid)')
        } else {
            drawInstance.current.fill('#ffffff')
        }
    }, [showGrid]);

    // Highlighting Logik
    useEffect(() => {
        Object.entries(shapes).forEach(([id, shape]) => {
            if (shape.shapeInstance) {
            try {
                if (shape.id === hoveredShapeId) {
                shape.shapeInstance.node.classList.add('hovered');
                } else {
                shape.shapeInstance.node.classList.remove('hovered');
                }
            } catch (err) {
                console.warn("Konnte Stroke nicht anwenden für Shape:", shape.shapeInstance.node.classList);
            }
            }
        });
    }, [hoveredShapeId, shapes]);

    // Highlighting Logik
    useEffect(() => {
        console.log("SelectedShapeIds changed:",selectedShapeIds, selectedShapeIds.map(([id,pts,ptids]) => id));
        Object.entries(shapes).forEach(([shapeId, shape]) => {
            if (shape.shapeInstance) {
                try {
                    if (selectedShapeIds.map(([id,pts,ptids]) => id).includes(shape.id)) {
                        shape.shapeInstance.node.classList.add('selected');
                    } else {
                        shape.shapeInstance.node.classList.remove('selected');
                    }
                } catch (err) {
                    console.warn("Konnte Stroke nicht anwenden für Shape:", shape.shapeInstance.node.classList);
                }
            }
        });
    }, [selectedShapeIds, shapes]);

    // const startClickPolygon = (shapeType='click-poly') => {
    //     if (!shapeType.includes('selection')){
    //         cleanRedoStack();
    //     }  
    //     setShapeType(shapeType);
    //     const poly = drawInstance.current.polygon()
    //     poly.node.classList.add(shapeType);
    //     poly.draw();
    //     setCurrentShape(poly);
    // };

    // const startRectangle = (shapeType='rectangle') => {
    //     console.log("Starting rectangle drawing, shapeType:", shapeType);
    //     if (!shapeType.includes('selection')) cleanRedoStack(); 
    //     const poly = drawInstance.current.rect()
    //     poly.node.classList.add(shapeType);
    //     poly.draw();
    //     setCurrentShape(poly);
    // }


    // Setup freehand drawing listeners with useEffect for proper cleanup
    useEffect(() => {
        // Capture the ref at the time effect runs - ensures we can clean up even if ref becomes null later
        const drawingArea = drawingAreaRef.current;
        if (!drawingArea || !drawInstance.current) {
            return;
        }
        const getCoords = (e) => {
            const rect = drawingArea.getBoundingClientRect();
            return [e.clientX - rect.left, e.clientY - rect.top];
        };
        // console.log("Setting up drawing listeners for shapeType:", shapeType);
        if (shapeType === 'click-poly') {
            let poly = null;
            let points = [];
            const handleClick = (e) => {
                console.log("Click for click-poly")
                points.push( getCoords(e) );
                if (!poly) {
                    poly = drawInstance.current.polygon(points)
                    poly.node.classList.add(shapeType);
                    console.log("new poly:", poly);
                };
                poly.plot(points);
                // console.log("Click at:", getCoords(e));
            };
            const handleMouseMove = (e) => {
                if (!poly || draggingPoints.current) return;
                poly.plot([...points, getCoords(e)]);
            };
            const handleRightClick = (e) => {
                if (points.length > 0) {
                    e.preventDefault();
                    if (points.length >= 3) {
                        if (!shapeType.includes('selection')){
                            cleanRedoStack();
                        }
                        createShapes(e, [{shapeInstance: poly, shapeClass: shapeType, id: ''}]);
                    }
                    stopDrawing(poly);
                    poly = null;
                    points = [];
                }
                else {
                    // console.log("Click-poly shape too small, deleting.");
                    stopDrawing(poly);
                    poly = null;
                    points = [];
                }
            }
            
            drawingArea.addEventListener('click', handleClick);
            drawingArea.addEventListener('contextmenu', handleRightClick);
            drawingArea.addEventListener('mousemove', handleMouseMove);
            
            return () => {
                drawingArea.removeEventListener('click', handleClick);
                drawingArea.removeEventListener('contextmenu', handleRightClick);
                drawingArea.removeEventListener('mousemove', handleMouseMove);
            };
        } else if (shapeType.includes('rectangle')) {
            let poly = null;
            let points = [];
            let anchor_x = null;
            let anchor_y = null;
            const timestamp = {t0:null}

            const handleMouseDown = (e) => {
                if (e.target.tagName === 'circle' && e.target.parentElement.classList.contains('shape-points')) return;
                let current_coords = getCoords(e);
                anchor_x = current_coords[0];
                anchor_y = current_coords[1];
                poly = drawInstance.current.polygon(points)
                poly.node.classList.add(shapeType);
                timestamp.t0 = Date.now();
            };

            const handleMouseMove = (e) => {
                if (!poly || anchor_x === null || anchor_y === null || draggingPoints.current) return;
                let [current_x, current_y] = getCoords(e);
                
                poly.plot([
                    [anchor_x, anchor_y],
                    [current_x, anchor_y],
                    [current_x, current_y],
                    [anchor_x, current_y]
                ]);
            };

            const handleMouseUp = (e) => {
                if (!poly || draggingPoints.current) return;
                if (Date.now()-timestamp.t0<350 - 250 * shapeType.includes('selection')) { 
                    poly.draw('done');
                    poly.draw('stop');
                    poly.remove();
                } else {
                    let [current_x, current_y] = getCoords(e);
                    // points.push([current_x, anchor_y], [current_x, current_y], [anchor_x, current_y]);
                    poly.plot([
                        [anchor_x, anchor_y],
                        [current_x, anchor_y],
                        [current_x, current_y],
                        [anchor_x, current_y],
                        [anchor_x, anchor_y],
                    ]);
                    createShapes(e, [{shapeInstance: poly, shapeClass: shapeType, id: ''}]);
                }
                poly = null;
                points = [];
            };

            drawingArea.addEventListener('mousedown', handleMouseDown);
            drawingArea.addEventListener('mousemove', handleMouseMove);
            drawingArea.addEventListener('mouseup', handleMouseUp);

            // Cleanup: remove listeners when shapeType changes
            return () => {
                drawingArea.removeEventListener('mousedown', handleMouseDown);
                drawingArea.removeEventListener('mousemove', handleMouseMove);
                drawingArea.removeEventListener('mouseup', handleMouseUp);
            };
        } else {
            const timestamp = {t0:null}
            let poly = null;
            let points = [];

            

            const handleMouseDown = (e) => {
                if (e.target.tagName === 'circle' && e.target.parentElement.classList.contains('shape-points')) return;
                points = [getCoords(e)];
                poly = drawInstance.current.polygon(points)
                poly.node.classList.add(shapeType);
                timestamp.t0 = Date.now();
            };

            const handleMouseMove = (e) => {
                if (!poly || points.length === 0 || draggingPoints.current) return;
                points.push(getCoords(e));
                poly.plot(points);
            };

            const handleMouseUp = (e) => {
                if (!poly || points.length === 0 || draggingPoints.current) return;
                console.log("Time elasped:", Date.now()-timestamp.t0, "Points drawn:", points.length);
                poly.draw('done');
                poly.draw('stop');
                if (Date.now()-timestamp.t0<300 && points.length < 10) { // delete short accidental clicks, threshold: 300ms & <10 points, maybe later addjustable
                    poly.remove();
                } else {
                    console.log("create freehand shape")
                    createShapes(e, [{shapeInstance: poly, shapeClass: shapeType, id: ''}]);
                }
                poly = null;
                points = [];
            };

            drawingArea.addEventListener('mousedown', handleMouseDown);
            drawingArea.addEventListener('mousemove', handleMouseMove);
            drawingArea.addEventListener('mouseup', handleMouseUp);

            // Cleanup: remove listeners when shapeType changes
            return () => {
                drawingArea.removeEventListener('mousedown', handleMouseDown);
                drawingArea.removeEventListener('mousemove', handleMouseMove);
                drawingArea.removeEventListener('mouseup', handleMouseUp);
            };
        };
    }, [shapeType, drawInstance]);
    
    

    useEffect(() => {
        if (selectedShapeIds.length === 0) return;
        // Capture the ref at the time effect runs - ensures we can clean up even if ref becomes null later
        const drawingArea = drawingAreaRef.current
        const getCoords = (e) => {
            const rect = drawingArea.getBoundingClientRect();
            return [e.clientX - rect.left, e.clientY - rect.top];
        };
        const startingCoords = [null, null]
        const lastCoords = [null, null]
        const getTranslateValues = (element) => {
            // return { transX: 0, transY: 0 };
            if (element) {
                // Holt die berechnete Matrix des Elements
                const transform = element.transform.baseVal.consolidate();
                if (transform) {
                    const { e, f } = transform.matrix; // e = translateX, f = translateY
                    return { transX: e, transY: f };
                }
            }
            return { transX: 0, transY: 0 };
        };
        const handleMouseDown = (e) => {
            if (e.target.tagName === 'circle' && e.target.parentElement.classList.contains('shape-points')){
                e.preventDefault();
                let [startX, startY] = getCoords(e)
                let {transX, transY} = getTranslateValues(selectedPtsRef.current)
                startingCoords[0] = startX - transX;
                startingCoords[1] = startY - transY;
                lastCoords[0] = startX
                lastCoords[1] = startY
                draggingPoints.current = true;
            }
        };
        
        const handleMouseMove = (e) => {
            if (!draggingPoints.current) return;
            let [lastX, lastY] = lastCoords;
            if (lastX === null || lastY === null) return;
            let [currentX, currentY] = getCoords(e)
            let [difX, difY] = [currentX - lastX, currentY - lastY];
            for (const [shapeId, pts, ptids] of selectedShapeIds){
                if (shapeId in shapes){
                    shapes[shapeId].shapeInstance.plot(shapes[shapeId].shapeInstance._array.map(([x,y], ptid) => ptids.includes(ptid) ? [x+difX,y+difY] : [x,y]))
                }
            }
            selectedPtsRef.current.setAttribute("transform", `translate(${currentX - startingCoords[0]} ${currentY - startingCoords[1]})`);;
            lastCoords[0] = currentX;
            lastCoords[1] = currentY;
        }
        const handleMouseUp = (e) => {
            let [startX, startY] = startingCoords;
            draggingPoints.current = false;
            if (startX === null || startY === null) return;
            let [currentX, currentY] = getCoords(e)
            let [difX, difY] = [currentX - startX, currentY - startY];
            const shapeObjArr = [];
            for (const [shapeId, pts, ptids] of selectedShapeIds){
                if (shapeId in shapes){
                    shapeObjArr.push({id: shapeId, shapeInstance: shapes[shapeId].shapeInstance, shapeClass: shapes[shapeId].shapeClass})
                }
            }
            // updateShapes(shapeObjArr, 'action')
            startingCoords[0] = null;
            startingCoords[1] = null;
        }
        
        drawingArea.addEventListener('mousedown', handleMouseDown);
        drawingArea.addEventListener('mousemove', handleMouseMove);
        drawingArea.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            drawingArea.removeEventListener('mousedown', handleMouseDown);
            drawingArea.removeEventListener('mousemove', handleMouseMove);
            drawingArea.removeEventListener('mouseup', handleMouseUp);
        };
    }, [selectedShapeIds, drawInstance]);
    // const startHoldPolygon = (shapeType='freehand') => {
    //     console.log("shapeType:",shapeType, typeof shapeType)
    //     if (!shapeType.includes('selection')){
    //         cleanRedoStack();
    //     };
    //     stopDrawing(currentShape);
    //     setShapeType(shapeType); // This triggers the useEffect above
    // };

    const endClickPolygon = (e) => {
        console.log("Finalizing shape on Enter key:", currentShape);
        // const currentPoly = drawInstance.current.polygon()
        // createShape(currentPoly, "click-poly");
        createShapes(e, [{shapeInstance: currentShape, shapeClass: "click-poly", id: ''}]);
        // 2. SOFORT ein neues starten (Auto-Reaktivierung)
        const nextPoly = drawInstance.current.polygon()
        nextPoly.node.classList.add('click-poly');
        // nextPoly.draw();
        setCurrentShape(nextPoly);
        };

    const deleteShapes = (ids, originType=['action','undo','redo'][0]) => {
        if (originType === 'action') {
            cleanRedoStack();
        } 
        // 1. Highlight zurücksetzen, falls das gelöschte Objekt markiert war
        if (ids.map(([id,pts,ptids]) => id).includes(hoveredShapeId)) setHoveredShapeId(-1);

        // 2. Direktzugriff über die ID (Dictionary-Style)
        let shapeInstances = ids.map(([id,pts,ptids]) => shapes[id]?.shapeInstance).filter(inst => inst);
        if (ids.length > 0) {

            // 3. State aktualisieren (Dictionary-Eintrag löschen)
            setShapes(prev => {
                const newShapes = { ...prev };
                ids.forEach(id => {
                    // Das SVG-Element verstecken, bevor wir die Referenz löschen
                    if (newShapes[id]) {
                    newShapes[id].shapeInstance.hide();
                    delete newShapes[id];
                    }
                });
                return newShapes;
            });
            if (originType === 'action') {
            pushAction("DELETE_SHAPES", { ids: ids, shapeInstances });
            } 
            // Aus dem SVG-DOM entfernen
        }
    };

    const updateShapes = (shapeUpdateArr, originType=['action','undo','redo'][0]) => {
        const oldShapeArr = [];
        setShapes(oldShapes => { 
            const newShapes = { ...oldShapes };
            shapeUpdateArr.forEach(shapeUpdate => {
                const { id, shapeInstance, shapeClass } = shapeUpdate; // TODO CHECK if thats correct to add updates like this.
                if (newShapes[id]) {
                    if (id in oldShapes){
                        oldShapeArr.push(oldShapes[id]);
                    }
                    newShapes[id] = { id, shapeInstance, shapeClass };
                }
            });
            sendSvgToBackend(shapeUpdateArr.map(({id}) => newShapes[id]))
            return newShapes;
        });
        if (originType === 'action') {
            pushAction("UPDATE_SHAPES", { shapeUpdateArr, oldShapeArr });
        }
    }

    const deleteVertices = (selectedShapeIds, originType=['action','undo','redo'][0]) => {
        setShapes(oldShapes => {
            const newShapes = {...oldShapes}
            const ids_to_delete = [];
            const shapeUpdateArr = [];
            const oldShapeArr = [];
            for (let [id, pts, ptids] of selectedShapeIds){
                if (id in oldShapes){
                    if (pts.length === 0 || oldShapes[id].shapeInstance._array.length - pts.length < 3){
                        ids_to_delete.push(id)
                    } else {
                        oldShapeArr.push({...oldShapes[id]})
                        newShapes[id].shapeInstance.plot(newShapes[id].shapeInstance._array.filter(([x,y], ptid) => !ptids.includes(ptid)))
                        shapeUpdateArr.push({id, shapeInstance:newShapes[id].shapeInstance, shapeClass:newShapes[id].shapeClass})
                    }
                }
            }
            sendSvgToBackend(shapeUpdateArr.map(({id}) => newShapes[id]))
            if (originType === 'action') {
                if (shapeUpdateArr.length > 0){
                    pushAction("UPDATE_SHAPES", { shapeUpdateArr, oldShapeArr });
                }
                if (ids_to_delete.length > 0){
                    pushAction("DELETE_SHAPES", { ids:ids_to_delete });
                }
            }
            setSelectedShapeIds([])
            return newShapes
        })

    }
    const rotateAll = (angle, originType=['action','undo','redo'][0]) => {
        Object.entries(shapes).forEach(([shapeId, shape]) => {
            const r = (shape.shapeInstance.transform().rotate || 0) + angle;
            shape.shapeInstance.animate(300).transform({ rotate: r });
        });
        if (originType === 'action') {
            pushAction("ROTATE_ALL", { angle });
        }
    };

    const clearAll = (originType=['action','undo','redo'][0]) => {
        if (originType === 'action') {
            pushAction("CLEAR_ALL", { shapes: {...shapes} });
        }
        setHoveredShapeId(-1);
        // drawInstance.current.clear();
        Object.entries(shapes).forEach(([shapeId, shape]) => {
            shape.shapeInstance.hide();
        });
        setShapes({});
        setCurrentShape(null);
    };

    const startSelectionRect = () => {

    };
    const startSelectionFreehand = () => {

    };

    const merge_shapes = (ids) => {
        console.log("Merging shapes:", ids);
    }

    const substract_shapes = (pos_id, substract_ids, keep_pos=True, keep_substract_ids=True) => {
        console.log("Substracting shapes:", substract_ids, "from", pos_id);
    }
    
    const toggleSelectVertices = (e) => {
        setSelectVertices(prev => !prev);
    };

    const filteredShapes = useMemo(() => {
        console.log("shapes",shapes)
        console.log("selectedShapeIds",selectedShapeIds)
        console.log("selectedShapeIds filtered", selectedShapeIds
            .filter(([id, pts, ptids]) => id in shapes))
        console.log("selectedShapeIds filtered map", selectedShapeIds
            .filter(([id, pts, ptids]) => id in shapes).map(([id]) => [id, shapes[id]]))
        return Object.fromEntries(
            selectedShapeIds
            .filter(([id, pts, ptids]) => id in shapes)
            .map(([id]) => [id, shapes[id]])
        );
    }, [selectedShapeIds, shapes]);

    const filteredSelectedShapeIds = useMemo(() => {
        console.log("before filter:",selectedShapeIds)
        console.log("after filter:",selectedShapeIds.filter(([id, pts, ptids]) => id in shapes && pts.length > 0))
        return selectedShapeIds.filter(([id, pts, ptids]) => id in shapes && pts.length > 0);
    }, [selectedShapeIds, shapes]);

    // UNDO: Letztes Element verstecken und in den Redo-Stack schieben
    const undoLast = (e) => {
        console.log("Undo stack before undo:", undoStack);
        if (undoStack.length === 0) return;
        const lastAction = undoStack[undoStack.length - 1];
        console.log("undoing action:", lastAction);
        if (lastAction.type === "CREATE_SHAPES") {
            deleteShapes(lastAction.data.shapeObjArr.map(s => s.id), 'undo');
        } else if (lastAction.type === "UPDATE_SHAPES") {
            updateShapes(lastAction.data.oldShapeArr, 'undo');
        } else if (lastAction.type === "DELETE_SHAPES") {
            console.log("00",lastAction.data.shapeInstances[0])
            createShapes(e, lastAction.data.shapeInstances, 'undo');
        } else if (lastAction.type === "ROTATE_ALL") {
            rotateAll(-lastAction.data.angle, 'undo');
        } else if (lastAction.type === "CLEAR_ALL") {
            console.log("Restoring shapes:", lastAction.data.shapes);
            setShapes(lastAction.data.shapes);
            Object.entries(lastAction.data.shapes).forEach(([shapeId, shape]) => {
            shape.shapeInstance.show();
            });
        }

        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [lastAction, ...prev]);
    };


    // REDO: Letztes Element aus dem Redo-Stack wieder anzeigen
    const redoLast = (e) => {
        console.log("Redo stack before redo:", redoStack);
        if (redoStack.length === 0) return;
        const nextAction = redoStack[0];

        if (nextAction.type === "CREATE_SHAPES") {
            createShapes(nextAction.data.shapeObjArr, 'redo');
        } else if (nextAction.type === "UPDATE_SHAPES") {
            updateShapes(nextAction.data.shapeUpdateArr, 'redo');
        } else if (nextAction.type === "DELETE_SHAPES") {
            deleteShapes(nextAction.data.ids, 'redo');
        } else if (nextAction.type === "ROTATE_ALL") {
            rotateAll(nextAction.data.angle, 'redo');
        } else if (nextAction.type === "CLEAR_ALL") {
            clearAll('redo');
        }

        setRedoStack(prev => prev.slice(1));
        setUndoStack(prev => [...prev, nextAction]);
    };

    
    return (
        <>
            {/* LEFT PANEL */}
            <Col 
                // md={3} lg={2} 
                xs="auto" 
                className="bg-light border-end p-3 shadow-sm"
            >
                <h5 className="mb-4">Tools</h5>
                <ListGroup variant="flush">
                {/* Section 1: Drawing */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Drawing
                </div>
                <ListGroup.Item action onClick={(e) => setShapeType('click-poly')} active={shapeType === 'click-poly'}>ClickPoly</ListGroup.Item>
                <ListGroup.Item action onClick={(e) => endClickPolygon(e)} disabled={!currentShape || !currentShape}>EndPoly</ListGroup.Item>
                <ListGroup.Item action onClick={(e) => setShapeType("rectangle")} active={shapeType === 'rectangle'}>Rectangle</ListGroup.Item>
                <ListGroup.Item action onClick={(e)=> setShapeType('freehand')} active={shapeType === 'freehand'}>Freehand</ListGroup.Item>
                
                {/* Section 2: Edit */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Edit
                </div>
                <ListGroup.Item action onClick={(e)=> rotateAll(45, 'action')}>RotateAll</ListGroup.Item>
                <ListGroup.Item action onClick={(e)=> clearAll('action')}>ClearAll</ListGroup.Item>
                
                {/* Section 3: undo redo */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Undo/Redo
                </div>
                <ListGroup.Item action onClick={(e) => undoLast(e)} disabled={undoStack.length === 0}>Undo</ListGroup.Item>
                <ListGroup.Item action onClick={(e) => redoLast(e)} disabled={redoStack.length === 0}>Redo</ListGroup.Item>
                
                {/* Section 2: EDITIEREN */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Selection
                </div>
                <ListGroup.Item action onClick={(e)=> setShapeType('rectangle-selection')}>Select (rect)</ListGroup.Item>
                <ListGroup.Item action onClick={(e)=> setShapeType('freehand-selection')}>Select (freehand)</ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between align-items-center bg-light">
                    <label htmlFor="select-vtx-toggle" style={{ cursor: 'pointer', marginBottom: 0 }}>
                        Select Vertices
                    </label>
                    <Form.Check 
                        type="switch"
                        id="select-vtx-toggle"
                        checked={selectVertices}
                        onChange={(e) => toggleSelectVertices(e)}
                    />
                </ListGroup.Item>

                {/* Section 3: undo redo */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    View
                </div>
                <ListGroup.Item className="d-flex justify-content-between align-items-center bg-light">
                    <label htmlFor="grid-toggle" style={{ cursor: 'pointer', marginBottom: 0 }}>
                        Show Grid
                    </label>
                    <Form.Check 
                        type="switch"
                        id="grid-toggle"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                    />
                </ListGroup.Item>
                </ListGroup>
            </Col>
            
            {/* CANVAS */}
            <Col 
                // md={6} lg={8}
                className="position-relative bg-white"
                >
                <div ref={drawingAreaRef} id="drawing-area">
                    {svgIsReady && drawInstance && drawInstance.current && (
                        <>
                        <SvgGrid svgRef={drawInstance.current.node} showGrid={showGrid} size={50} />
                        {selectVertices &&  (<SvgPoints 
                            svgRef={drawInstance.current.node} 
                            selectedShapeIds={filteredSelectedShapeIds}
                            filteredShapes={filteredShapes} 
                            selectedPtsRef={selectedPtsRef}/>
                        )}
                        </>
                    )}
                </div>
            </Col>

            {/* RIGHT PANEL */}
            <Col md={3} lg={2} className="position-relative bg-light border-end p-3 shadow-sm">
                <h5 className="mb-4">Shapes</h5>
                <ListGroup variant="flush" className="border rounded">
                {Object.entries(shapes).map(([id, shape]) => (
                    <ListGroup.Item key={id} 
                        onClick={(e) => selectShapes(e, [[id,[],[]]])} 
                        onMouseEnter={(e) => setHoveredShapeId(id)} 
                        onMouseLeave={(e) => setHoveredShapeId(-1)}
                        className={`p-3 shape-list-item ${hoveredShapeId === id ? 'hovered' : ''} ${selectedShapeIds.map(([sid,pts,ptids]) => sid).includes(id) ? 'selected' : ''} ${shape.shapeClass}`}>
                    {/* Stack (Flexbox) sorgt für die vertikale Anordnung (gap-2 = Abstand) */}
                    <Stack gap={2}>
                        <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-bold fs-5">{id}</span>
                        <Badge bg="secondary">{shape.shapeInstance?.type ? shape.shapeInstance.type : 'Shape'}</Badge>
                        </div>
                        
                        <div className="d-flex gap-2 mt-2">
                        {/* 'w-100' lässt die Buttons die volle Breite einnehmen, falls gewünscht */}
                        <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="flex-grow-1"
                            onClick={() => onMerge(id)}
                        >
                            Merge
                        </Button>
                        <Button 
                            variant="danger" 
                            size="sm" 
                            className="flex-grow-1"
                            onClick={() => deleteShapes([id])}
                        >
                            Delete
                        </Button>
                        </div>
                    </Stack>
                    </ListGroup.Item>
                ))}
                </ListGroup>
            </Col>
        </>
    )
}

export default P_Shapes

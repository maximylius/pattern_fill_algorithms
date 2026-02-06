import { createPortal } from 'react-dom';
import { useState, useEffect, useRef, memo } from 'react'

const SvgPoints = memo(function SvgPoints({ svgRef, selectedShapeIds, filteredShapes, selectedPtsRef }) {
    const [startingCoords, setStartingCoords] = useState([null, null]);

    //   useEffect(() => {
    //     if (svgRef.current) {
    //       setMounted(true);
    //     }
    //   }, [svgRef]); // Reagiert, wenn die Ref zugewiesen wird

    // Sicherheitsscheck: Nur rendern, wenn Ref da, Grid an und Komponente "bereit"
    // if (!mounted || !svgRef.current || !showGrid) return null

    // Wir "beamen" dieses JSX direkt als erstes Element in das existierende SVG
    
    const renderCount = useRef(0);
    renderCount.current += 1;

    console.log(`Render-count: ${renderCount.current}`);

    useEffect(() => {
        if (selectedPtsRef.current && svgRef) {
            // Verschiebt das <g> Element ans Ende des SVGs
            svgRef.appendChild(selectedPtsRef.current);
        }
    }, [selectedShapeIds, svgRef])

    return createPortal(
        // svgRef, 
        <>
            <g className="svg-points" ref={selectedPtsRef}>
                {selectedShapeIds.filter(([id, pts, ptids]) => id in filteredShapes && pts.length > 0).map(([id, pts, ptids]) => (
                    <g key={"sg"+id} className="shape-points">
                        {ptids.map(
                            ptid => filteredShapes[id].shapeInstance._array[ptid]
                        ).map(([x,y], i) => (
                            <circle
                                key={"sg"+id+"_pt"+i}
                                cx={x}
                                cy={y}
                                r="6"
                                fill="red"
                                style={{ cursor: 'move' }}
                                onDrag={(e) => handleDrag(e)}
                                // onMouseDown={(e) => handleMouseDown(e)}
                                // onMouseMove={(e) => handleMouseMove(e)}
                                // onMouseUp={(e) => handleMouseUp(e)}
                            />
                        ))}    
                    </g>
                ))}
            </g> 
        </> , svgRef 
         // Das Ziel-Element (dein vorhandenes SVG)
    );
});

export default SvgPoints;
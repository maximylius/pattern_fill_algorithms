import { createPortal } from 'react-dom';
import { useEffect, useRef, memo } from 'react';
import type { RefObject } from 'react';
import type { SelectedShapeEntry, ShapeRecord } from './types';

interface SvgPointsProps {
  svgRef: SVGSVGElement;
  selectedShapeIds: SelectedShapeEntry[];
  filteredShapes: Record<string, ShapeRecord>;
  selectedPtsRef: RefObject<SVGGElement | null>;
}

const SvgPoints = memo(function SvgPoints({ svgRef, selectedShapeIds, filteredShapes, selectedPtsRef }: SvgPointsProps) {
    const renderCount = useRef(0);
    renderCount.current += 1;

    console.log(`Render-count: ${renderCount.current}`);

    useEffect(() => {
        if (selectedPtsRef.current && svgRef) {
            svgRef.appendChild(selectedPtsRef.current);
        }
    }, [selectedShapeIds, svgRef])

    // TODO: implement drag handler
    const handleDrag = (_e: React.DragEvent<SVGCircleElement>) => {};

    return createPortal(
        <>
            <g className="svg-points" ref={selectedPtsRef}>
                {selectedShapeIds.filter(([id, pts]) => id in filteredShapes && pts.length > 0).map(([id, pts, ptids]) => (
                    <g key={"sg"+id} className="shape-points">
                        {ptids.map(
                            ptid => filteredShapes[id].shapeInstance._array[ptid]
                        ).map(([x, y], i) => (
                            <circle
                                key={"sg"+id+"_pt"+i}
                                cx={x}
                                cy={y}
                                r="6"
                                fill="red"
                                style={{ cursor: 'move' }}
                                onDrag={(e) => handleDrag(e)}
                            />
                        ))}
                    </g>
                ))}
            </g>
        </>, svgRef
    );
});

export default SvgPoints;

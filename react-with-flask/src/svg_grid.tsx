import { createPortal } from 'react-dom';

interface SvgGridProps {
  svgRef: SVGSVGElement;
  showGrid: boolean;
  size?: number;
}

function SvgGrid({ svgRef, showGrid, size = 50 }: SvgGridProps) {
    if (!showGrid) return null;

    return createPortal(
    <>
        <defs id="grid-defs">
        <pattern id="js-grid" width={size} height={size} patternUnits="userSpaceOnUse">
            {/* Raster-Linien */}
            <path d={`M 0 0 L ${size} 0 ${size} ${size} 0 ${size}`} fill="none" stroke="#ccc" strokeWidth="3" />
        </pattern>
        </defs>
        {/* Das Hintergrund-Rechteck */}
        <rect className='grid' width="100%" height="100%" fill="url(#js-grid)" />
    </>,
    svgRef
    );
}

export default SvgGrid;

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react'

function SvgGrid({ svgRef, showGrid, size = 50 }) {
    //  const [mounted, setMounted] = useState(false);

    //   useEffect(() => {
    //     if (svgRef.current) {
    //       setMounted(true);
    //     }
    //   }, [svgRef]); // Reagiert, wenn die Ref zugewiesen wird

    // Sicherheitsscheck: Nur rendern, wenn Ref da, Grid an und Komponente "bereit"
    // if (!mounted || !svgRef.current || !showGrid) return null
    if (!showGrid) return null

    // Wir "beamen" dieses JSX direkt als erstes Element in das existierende SVG
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
    svgRef // Das Ziel-Element (dein vorhandenes SVG)
    );
}

export default SvgGrid;
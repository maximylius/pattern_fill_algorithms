import { useState, useEffect, useRef, useMemo } from 'react'
import { SVG } from '@svgdotjs/svg.js';
import type { Svg } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.draw.js';
import { Button, ListGroup, Stack, Badge, Row, Col, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import SvgGrid from './svg_grid';
import SvgPoints from './svg_points';
import type {
    Point,
    ShapeId,
    SelectedShapeEntry,
    SvgPolygon,
    ShapeRecord,
    ShapesDict,
    ShapeObjItem,
    OriginType,
    UndoRedoAction,
} from './types';

//  TODO: make functions accept the creation and deletion of multiple shapes at once for better undo/redo performance
function P_Shapes() {
    const selectedPtsRef = useRef<SVGGElement | null>(null);
    const [nextShapeId, setNextShapeId] = useState<number>(0)
    const [selectedShapeIds, setSelectedShapeIds] = useState<SelectedShapeEntry[]>([]);
    const [selectedVertices, setSelectedVertices] = useState<boolean>([]);
    const [hoveredShapeId, setHoveredShapeId] = useState<ShapeId | number>(-1)
    const drawingAreaRef = useRef<HTMLDivElement | null>(null);
    const drawInstance = useRef<Svg | null>(null);
    const [currentShape, setCurrentShape] = useState<SvgPolygon | null>(null);
    const [shapes, setShapes] = useState<ShapesDict>({});
    const [undoStack, setUndoStack] = useState<UndoRedoAction[]>([]);
    const [redoStack, setRedoStack] = useState<UndoRedoAction[]>([]);
    const [shapeType, setShapeType] = useState<string>("freehand");
    const [selectVertices, setSelectVertices] = useState<boolean>(true);
    const [showGrid, setShowGrid] = useState<boolean>(true);
    const [svgIsReady, setSvgIsReady] = useState<boolean>(false);
    const [currentTool, setCurrentTool] = useState<string>("click-poly");
    const shapeInstanceRef = useRef<SvgPolygon | null>(currentShape);
    const draggingPoints = { current: false };

    const sendSvgToBackend = async (shapeObjArr: ShapeObjItem[]) => {
        const shapesToSend: { points: Point[]; type: string; id: ShapeId }[] = [];
        shapeObjArr.forEach(({ shapeInstance, shapeClass, id }) => {
            const points: Point[] = [];
            for (const point of shapeInstance.node.points) {
                points.push([point.x, point.y]);
            }
            shapesToSend.push({ points, type: shapeClass, id });
        });
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
            await response.json();
        } catch (error) {
            console.error('Fehler beim Senden:', error);
        }
    };

    const deleteSvgsFromBackend = async (shapeIds: ShapeId[]) => {
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

    const selectShapesFromBackend = async (e: MouseEvent, shapeInstance: SvgPolygon) => {
        const points: Point[] = [];
        for (const point of shapeInstance.node.points) {
            points.push([point.x, point.y]);
        }
        try {
            const response = await fetch('/api/select-shapes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operation: 'SELECT_SHAPES',
                    selectVertices,
                    points,
                }),
            });
            const data = await response.json();
            const selectedShapeIdPoints: SelectedShapeEntry[] = data.selectedShapeIdPoints.map(
                ([shapeId, pts]: [ShapeId, Point[]]) => [
                    shapeId,
                    pts,
                    shapes[shapeId]?.shapeInstance?._array
                        ?.map((xy: Point, n: number) => pts.some(ptxy => JSON.stringify(ptxy) === JSON.stringify(xy)) ? n : -1)
                        .filter((el: number) => el !== -1) ?? []
                ]
            );
            console.log("settin-1:", selectedShapeIdPoints);
            selectShapes(e, selectedShapeIdPoints);
        } catch (error) {
            console.error('Fehler beim Senden:', error);
        }
    };

    const selectShapes = (e: MouseEvent, selectedShapeIdPoints: SelectedShapeEntry[]) => {
        e.preventDefault();
        if (!Array.isArray(selectedShapeIdPoints)) {
            console.warn("selectShapes erwartet ein Array von IDs, erhielt stattdessen:", selectedShapeIdPoints);
            return;
        }

        setSelectedShapeIds(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
            const prevIds = prevArr.map(([id]) => id);
            const newIds = selectedShapeIdPoints.map(([id]) => id);
            if (e?.ctrlKey) {
                return [...prevArr.filter(([id]) => !newIds.includes(id)), ...selectedShapeIdPoints.filter(([id]) => !prevIds.includes(id))];
            }
            console.log("setting:0", selectedShapeIdPoints);
            return selectedShapeIdPoints;
        });
        setSelectedVertices(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
        });
    };

    const pushAction = (action: UndoRedoAction) => {
        setUndoStack(prev => [...prev, action]);
        setRedoStack([]);
    };

    const cleanRedoStack = () => {
        for (const action of redoStack) {
            if (action.type === "CREATE_SHAPES") {
                const idsToDelete: ShapeId[] = [];
                for (const { shapeInstance, id } of action.data.shapeObjArr) {
                    shapeInstance.remove();
                    idsToDelete.push(id);
                }
                deleteSvgsFromBackend(idsToDelete);
            }
        }
        setRedoStack([]);
    };

    const addHoverListeners = (shape: SvgPolygon, newShapeId: ShapeId) => {
        shape.on('mouseenter', () => setHoveredShapeId(newShapeId));
        shape.on('mouseleave', () => setHoveredShapeId(-1));
        shape.on('click', (e: Event) => {
            console.log("Shape clicked:", newShapeId, (e as MouseEvent).ctrlKey);
            selectShapes(e as MouseEvent, [[newShapeId, [], []]]);
        });
    };

    const createShapes = (e: MouseEvent | KeyboardEvent, shapeObjArr: ShapeObjItem[], originType: OriginType = 'action') => {
        if (shapeObjArr.length === 0) return;
        if (shapeObjArr.length > 1 || !shapeObjArr[0].shapeClass.includes('selection')) {
            if (originType === 'action') {
                cleanRedoStack();
            }
            setShapes(prev => {
                const updatedShapes = { ...prev };
                const shapesToSend: ShapeObjItem[] = [];
                for (const { shapeInstance, shapeClass, id } of shapeObjArr) {
                    if (!shapeInstance) return prev;
                    if (typeof shapeInstance.draw === 'function') {
                        shapeInstance.draw('done');
                        shapeInstance.draw('stop');
                    }
                    const currentId = id === '' ? Date.now().toString() : id;
                    shapesToSend.push({ shapeInstance, shapeClass, id: currentId });
                    updatedShapes[currentId] = {
                        id: currentId,
                        shapeClass,
                        shapeInstance,
                    };
                    if (originType === 'action') {
                        addHoverListeners(shapeInstance, currentId);
                    } else {
                        shapeInstance.show();
                    }
                }
                sendSvgToBackend(shapesToSend);
                return updatedShapes;
            });

            if (originType === 'action') {
                pushAction({ type: "CREATE_SHAPES", data: { shapeObjArr } });
            }
            setCurrentShape(null);
        } else {
            const { shapeInstance, shapeClass } = shapeObjArr[0];
            if (typeof shapeInstance.draw === 'function') {
                shapeInstance.draw('done');
                shapeInstance.draw('stop');
            }
            // Selection shapes are not stored
            selectShapesFromBackend(e as MouseEvent, shapeInstance);
            shapeInstance.animate(300).opacity(0).after(() => shapeInstance.remove());
        }
    };

    const stopDrawing = (_shapeInstance2: SvgPolygon | null) => {
        const shapeInstance = shapeInstanceRef.current;
        console.warn("Stopping drawing for shapeInstance:", shapeInstance);
        if (shapeInstance) {
            console.log("Stopping shape drawing:", shapeInstance);
            shapeInstance.draw('done');
            shapeInstance.draw('stop');
            shapeInstance.remove();
            setCurrentShape(null);
        }
    };

    // Initialisierung & Enter-Key Listener
    useEffect(() => {
        if (drawingAreaRef.current && !drawInstance.current) {
            drawInstance.current = SVG().addTo(drawingAreaRef.current).size('100%', '100%');
            setSvgIsReady(true);
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && currentShape) {
                console.log("Finalizing shape on Enter key:", currentShape?.node?.points?.length, currentShape?.node?.classList?.contains('click-poly'));
                createShapes(e, [{ shapeInstance: currentShape, shapeClass: "click-poly", id: '' }]);
                const nextPoly = drawInstance.current!.polygon() as unknown as SvgPolygon;
                nextPoly.node.classList.add('click-poly');
                setCurrentShape(nextPoly);
            } else if (e.key === 'Delete') {
                console.log("Pressed delete key", selectVertices);
                if (selectVertices) {
                    deleteVertices(selectedShapeIds, 'action');
                } else {
                    deleteShapes(selectedShapeIds.map(([id]) => id), 'action');
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
        if (!drawInstance.current) return;
        if (showGrid) {
            drawInstance.current.fill('url(#js-grid)');
        } else {
            drawInstance.current.fill('#ffffff');
        }
    }, [showGrid]);

    // Hover highlighting
    useEffect(() => {
        Object.entries(shapes).forEach(([_id, shape]) => {
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

    // Selection highlighting
    useEffect(() => {
        console.log("SelectedShapeIds changed:", selectedShapeIds, selectedShapeIds.map(([id]) => id));
        Object.entries(shapes).forEach(([_shapeId, shape]) => {
            if (shape.shapeInstance) {
                try {
                    if (selectedShapeIds.map(([id]) => id).includes(shape.id)) {
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

    // Setup drawing listeners
    useEffect(() => {
        const drawingArea = drawingAreaRef.current;
        if (!drawingArea || !drawInstance.current) return;

        const getCoords = (e: MouseEvent): Point => {
            const rect = drawingArea.getBoundingClientRect();
            return [e.clientX - rect.left, e.clientY - rect.top];
        };

        if (shapeType === 'click-poly') {
            let poly: SvgPolygon | null = null;
            let points: Point[] = [];

            const handleClick = (e: MouseEvent) => {
                console.log("Click for click-poly");
                points.push(getCoords(e));
                if (!poly) {
                    poly = drawInstance.current!.polygon(points) as unknown as SvgPolygon;
                    poly.node.classList.add(shapeType);
                    console.log("new poly:", poly);
                }
                poly.plot(points);
            };

            const handleMouseMove = (e: MouseEvent) => {
                if (!poly || draggingPoints.current) return;
                poly.plot([...points, getCoords(e)]);
            };

            const handleRightClick = (e: MouseEvent) => {
                if (points.length > 0) {
                    e.preventDefault();
                    if (points.length >= 3) {
                        if (!shapeType.includes('selection')) {
                            cleanRedoStack();
                        }
                        createShapes(e, [{ shapeInstance: poly!, shapeClass: shapeType, id: '' }]);
                    }
                    stopDrawing(poly);
                    poly = null;
                    points = [];
                } else {
                    stopDrawing(poly);
                    poly = null;
                    points = [];
                }
            };

            drawingArea.addEventListener('click', handleClick);
            drawingArea.addEventListener('contextmenu', handleRightClick);
            drawingArea.addEventListener('mousemove', handleMouseMove);

            return () => {
                drawingArea.removeEventListener('click', handleClick);
                drawingArea.removeEventListener('contextmenu', handleRightClick);
                drawingArea.removeEventListener('mousemove', handleMouseMove);
            };
        } else if (shapeType.includes('rectangle')) {
            let poly: SvgPolygon | null = null;
            let points: Point[] = [];
            let anchor_x: number | null = null;
            let anchor_y: number | null = null;
            const timestamp = { t0: 0 };

            const handleMouseDown = (e: MouseEvent) => {
                if (e.target instanceof Element && e.target.tagName === 'circle' && e.target.parentElement?.classList.contains('shape-points')) return;
                const current_coords = getCoords(e);
                anchor_x = current_coords[0];
                anchor_y = current_coords[1];
                poly = drawInstance.current!.polygon(points) as unknown as SvgPolygon;
                poly.node.classList.add(shapeType);
                timestamp.t0 = Date.now();
            };

            const handleMouseMove = (e: MouseEvent) => {
                if (!poly || anchor_x === null || anchor_y === null || draggingPoints.current) return;
                const [current_x, current_y] = getCoords(e);
                poly.plot([
                    [anchor_x, anchor_y],
                    [current_x, anchor_y],
                    [current_x, current_y],
                    [anchor_x, current_y],
                ]);
            };

            const handleMouseUp = (e: MouseEvent) => {
                if (!poly || draggingPoints.current) return;
                if (Date.now() - timestamp.t0 < 350 - 250 * (shapeType.includes('selection') ? 1 : 0)) {
                    poly.draw('done');
                    poly.draw('stop');
                    poly.remove();
                } else {
                    const [current_x, current_y] = getCoords(e);
                    poly.plot([
                        [anchor_x!, anchor_y!],
                        [current_x, anchor_y!],
                        [current_x, current_y],
                        [anchor_x!, current_y],
                        [anchor_x!, anchor_y!],
                    ]);
                    createShapes(e, [{ shapeInstance: poly, shapeClass: shapeType, id: '' }]);
                }
                poly = null;
                points = [];
            };

            drawingArea.addEventListener('mousedown', handleMouseDown);
            drawingArea.addEventListener('mousemove', handleMouseMove);
            drawingArea.addEventListener('mouseup', handleMouseUp);

            return () => {
                drawingArea.removeEventListener('mousedown', handleMouseDown);
                drawingArea.removeEventListener('mousemove', handleMouseMove);
                drawingArea.removeEventListener('mouseup', handleMouseUp);
            };
        } else {
            const timestamp = { t0: 0 };
            let poly: SvgPolygon | null = null;
            let points: Point[] = [];

            const handleMouseDown = (e: MouseEvent) => {
                if (e.target instanceof Element && e.target.tagName === 'circle' && e.target.parentElement?.classList.contains('shape-points')) return;
                points = [getCoords(e)];
                poly = drawInstance.current!.polygon(points) as unknown as SvgPolygon;
                poly.node.classList.add(shapeType);
                timestamp.t0 = Date.now();
            };

            const handleMouseMove = (e: MouseEvent) => {
                if (!poly || points.length === 0 || draggingPoints.current) return;
                points.push(getCoords(e));
                poly.plot(points);
            };

            const handleMouseUp = (e: MouseEvent) => {
                if (!poly || points.length === 0 || draggingPoints.current) return;
                console.log("Time elapsed:", Date.now() - timestamp.t0, "Points drawn:", points.length);
                poly.draw('done');
                poly.draw('stop');
                if (Date.now() - timestamp.t0 < 300 && points.length < 10) {
                    poly.remove();
                } else {
                    console.log("create freehand shape");
                    createShapes(e, [{ shapeInstance: poly, shapeClass: shapeType, id: '' }]);
                }
                poly = null;
                points = [];
            };

            drawingArea.addEventListener('mousedown', handleMouseDown);
            drawingArea.addEventListener('mousemove', handleMouseMove);
            drawingArea.addEventListener('mouseup', handleMouseUp);

            return () => {
                drawingArea.removeEventListener('mousedown', handleMouseDown);
                drawingArea.removeEventListener('mousemove', handleMouseMove);
                drawingArea.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [shapeType, drawInstance]);

    useEffect(() => {
        if (selectedShapeIds.length === 0) return;
        const drawingArea = drawingAreaRef.current;
        if (!drawingArea) return;

        const getCoords = (e: MouseEvent): Point => {
            const rect = drawingArea.getBoundingClientRect();
            return [e.clientX - rect.left, e.clientY - rect.top];
        };

        const startingCoords: [number | null, number | null] = [null, null];
        const lastCoords: [number | null, number | null] = [null, null];

        const getTranslateValues = (element: SVGGElement | null): { transX: number; transY: number } => {
            if (element) {
                const transform = element.transform.baseVal.consolidate();
                if (transform) {
                    const { e, f } = transform.matrix;
                    return { transX: e, transY: f };
                }
            }
            return { transX: 0, transY: 0 };
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.target instanceof Element && e.target.tagName === 'circle' && e.target.parentElement?.classList.contains('shape-points')) {
                e.preventDefault();
                const [startX, startY] = getCoords(e);
                const { transX, transY } = getTranslateValues(selectedPtsRef.current);
                startingCoords[0] = startX - transX;
                startingCoords[1] = startY - transY;
                lastCoords[0] = startX;
                lastCoords[1] = startY;
                draggingPoints.current = true;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingPoints.current) return;
            const [lastX, lastY] = lastCoords;
            if (lastX === null || lastY === null) return;
            const [currentX, currentY] = getCoords(e);
            const [difX, difY] = [currentX - lastX, currentY - lastY];
            for (const [shapeId, _pts, ptids] of selectedShapeIds) {
                if (shapeId in shapes) {
                    shapes[shapeId].shapeInstance.plot(
                        shapes[shapeId].shapeInstance._array.map(([x, y]: Point, ptid: number) =>
                            ptids.includes(ptid) ? [x + difX, y + difY] : [x, y]
                        )
                    );
                }
            }
            if (selectedPtsRef.current) {
                selectedPtsRef.current.setAttribute("transform", `translate(${currentX - startingCoords[0]!} ${currentY - startingCoords[1]!})`);
            }
            lastCoords[0] = currentX;
            lastCoords[1] = currentY;
        };

        const handleMouseUp = (e: MouseEvent) => {
            const [startX, startY] = startingCoords;
            draggingPoints.current = false;
            if (startX === null || startY === null) return;
            const shapeObjArr: ShapeObjItem[] = [];
            for (const [shapeId, _pts, ptids] of selectedShapeIds) {
                if (shapeId in shapes) {
                    shapeObjArr.push({ id: shapeId, shapeInstance: shapes[shapeId].shapeInstance, shapeClass: shapes[shapeId].shapeClass });
                }
            }
            startingCoords[0] = null;
            startingCoords[1] = null;
        };

        drawingArea.addEventListener('mousedown', handleMouseDown);
        drawingArea.addEventListener('mousemove', handleMouseMove);
        drawingArea.addEventListener('mouseup', handleMouseUp);

        return () => {
            drawingArea.removeEventListener('mousedown', handleMouseDown);
            drawingArea.removeEventListener('mousemove', handleMouseMove);
            drawingArea.removeEventListener('mouseup', handleMouseUp);
        };
    }, [selectedShapeIds, drawInstance]);

    const endClickPolygon = (e: React.MouseEvent) => {
        console.log("Finalizing shape on Enter key:", currentShape);
        createShapes(e.nativeEvent, [{ shapeInstance: currentShape!, shapeClass: "click-poly", id: '' }]);
        const nextPoly = drawInstance.current!.polygon() as unknown as SvgPolygon;
        nextPoly.node.classList.add('click-poly');
        setCurrentShape(nextPoly);
    };

    const deleteShapes = (ids: ShapeId[], originType: OriginType = 'action') => {
        if (originType === 'action') {
            cleanRedoStack();
        }
        if (ids.includes(hoveredShapeId as ShapeId)) setHoveredShapeId(-1);

        const shapeInstances = ids.map(id => shapes[id]?.shapeInstance).filter((inst): inst is SvgPolygon => !!inst);
        if (ids.length > 0) {
            setShapes(prev => {
                const newShapes = { ...prev };
                ids.forEach(id => {
                    if (newShapes[id]) {
                        newShapes[id].shapeInstance.hide();
                        delete newShapes[id];
                    }
                });
                return newShapes;
            });
            if (originType === 'action') {
                pushAction({ type: "DELETE_SHAPES", data: { ids, shapeInstances } });
            }
        }
    };

    const updateShapes = (shapeUpdateArr: ShapeObjItem[], originType: OriginType = 'action') => {
        const oldShapeArr: ShapeRecord[] = [];
        setShapes(oldShapes => {
            const newShapes = { ...oldShapes };
            shapeUpdateArr.forEach(shapeUpdate => {
                const { id, shapeInstance, shapeClass } = shapeUpdate;
                if (newShapes[id]) {
                    if (id in oldShapes) {
                        oldShapeArr.push(oldShapes[id]);
                    }
                    newShapes[id] = { id, shapeInstance, shapeClass };
                }
            });
            sendSvgToBackend(shapeUpdateArr.map(({ id }) => newShapes[id]));
            return newShapes;
        });
        if (originType === 'action') {
            pushAction({ type: "UPDATE_SHAPES", data: { shapeUpdateArr, oldShapeArr } });
        }
    };

    const deleteVertices = (selectedShapeIds: SelectedShapeEntry[], originType: OriginType = 'action') => {
        setShapes(oldShapes => {
            const newShapes = { ...oldShapes };
            const ids_to_delete: ShapeId[] = [];
            const shapeUpdateArr: ShapeObjItem[] = [];
            const oldShapeArr: ShapeRecord[] = [];
            for (const [id, pts, ptids] of selectedShapeIds) {
                if (id in oldShapes) {
                    if (pts.length === 0 || oldShapes[id].shapeInstance._array.length - pts.length < 3) {
                        ids_to_delete.push(id);
                    } else {
                        oldShapeArr.push({ ...oldShapes[id] });
                        newShapes[id].shapeInstance.plot(
                            newShapes[id].shapeInstance._array.filter((_xy: Point, ptid: number) => !ptids.includes(ptid))
                        );
                        shapeUpdateArr.push({ id, shapeInstance: newShapes[id].shapeInstance, shapeClass: newShapes[id].shapeClass });
                    }
                }
            }
            sendSvgToBackend(shapeUpdateArr.map(({ id }) => newShapes[id]));
            if (originType === 'action') {
                if (shapeUpdateArr.length > 0) {
                    pushAction({ type: "UPDATE_SHAPES", data: { shapeUpdateArr, oldShapeArr } });
                }
                if (ids_to_delete.length > 0) {
                    pushAction({ type: "DELETE_SHAPES", data: { ids: ids_to_delete, shapeInstances: [] } });
                }
            }
            setSelectedShapeIds([]);
            return newShapes;
        });
    };

    const rotateAll = (angle: number, originType: OriginType = 'action') => {
        Object.entries(shapes).forEach(([_shapeId, shape]) => {
            const r = (shape.shapeInstance.transform().rotate || 0) + angle;
            shape.shapeInstance.animate(300).transform({ rotate: r });
        });
        if (originType === 'action') {
            pushAction({ type: "ROTATE_ALL", data: { angle } });
        }
    };

    const clearAll = (originType: OriginType = 'action') => {
        if (originType === 'action') {
            pushAction({ type: "CLEAR_ALL", data: { shapes: { ...shapes } } });
        }
        setHoveredShapeId(-1);
        Object.entries(shapes).forEach(([_shapeId, shape]) => {
            shape.shapeInstance.hide();
        });
        setShapes({});
        setCurrentShape(null);
    };

    const startSelectionRect = () => {};
    const startSelectionFreehand = () => {};

    const merge_shapes = (ids: ShapeId[]) => {
        console.log("Merging shapes:", ids);
    };

    const substract_shapes = (pos_id: ShapeId, substract_ids: ShapeId[], keep_pos = true, keep_substract_ids = true) => {
        console.log("Substracting shapes:", substract_ids, "from", pos_id);
    };

    const toggleSelectVertices = () => {
        setSelectVertices(prev => !prev);
    };

    const filteredShapes = useMemo(() => {
        console.log("shapes", shapes);
        console.log("selectedShapeIds", selectedShapeIds);
        return Object.fromEntries(
            selectedShapeIds
                .filter(([id]) => id in shapes)
                .map(([id]) => [id, shapes[id]])
        );
    }, [selectedShapeIds, shapes]);

    const filteredSelectedShapeIds = useMemo(() => {
        return selectedShapeIds.filter(([id, pts]) => id in shapes && pts.length > 0);
    }, [selectedShapeIds, shapes]);

    const undoLast = (e: KeyboardEvent | React.MouseEvent) => {
        console.log("Undo stack before undo:", undoStack);
        if (undoStack.length === 0) return;
        const lastAction = undoStack[undoStack.length - 1];
        console.log("undoing action:", lastAction);
        const nativeE = 'nativeEvent' in e ? e.nativeEvent as MouseEvent : e as KeyboardEvent;
        if (lastAction.type === "CREATE_SHAPES") {
            deleteShapes(lastAction.data.shapeObjArr.map(s => s.id), 'undo');
        } else if (lastAction.type === "UPDATE_SHAPES") {
            updateShapes(lastAction.data.oldShapeArr, 'undo');
        } else if (lastAction.type === "DELETE_SHAPES") {
            console.log("00", lastAction.data.shapeInstances[0]);
            createShapes(nativeE, lastAction.data.shapeInstances, 'undo');
        } else if (lastAction.type === "ROTATE_ALL") {
            rotateAll(-lastAction.data.angle, 'undo');
        } else if (lastAction.type === "CLEAR_ALL") {
            console.log("Restoring shapes:", lastAction.data.shapes);
            setShapes(lastAction.data.shapes);
            Object.entries(lastAction.data.shapes).forEach(([_shapeId, shape]) => {
                shape.shapeInstance.show();
            });
        }
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [lastAction, ...prev]);
    };

    const redoLast = (e: KeyboardEvent | React.MouseEvent) => {
        console.log("Redo stack before redo:", redoStack);
        if (redoStack.length === 0) return;
        const nextAction = redoStack[0];
        const nativeE = 'nativeEvent' in e ? e.nativeEvent as MouseEvent : e as KeyboardEvent;
        if (nextAction.type === "CREATE_SHAPES") {
            createShapes(nativeE, nextAction.data.shapeObjArr, 'redo');
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
                xs="auto"
                className="bg-light border-end p-3 shadow-sm"
            >
                <h5 className="mb-4">Tools</h5>
                <ListGroup variant="flush">
                {/* Section 1: Drawing */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Drawing
                </div>
                <ListGroup.Item action onClick={() => setShapeType('click-poly')} active={shapeType === 'click-poly'}>ClickPoly</ListGroup.Item>
                <ListGroup.Item action onClick={(e) => endClickPolygon(e)} disabled={!currentShape}>EndPoly</ListGroup.Item>
                <ListGroup.Item action onClick={() => setShapeType("rectangle")} active={shapeType === 'rectangle'}>Rectangle</ListGroup.Item>
                <ListGroup.Item action onClick={() => setShapeType('freehand')} active={shapeType === 'freehand'}>Freehand</ListGroup.Item>

                {/* Section 2: Edit */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Edit
                </div>
                <ListGroup.Item action onClick={() => rotateAll(45, 'action')}>RotateAll</ListGroup.Item>
                <ListGroup.Item action onClick={() => clearAll('action')}>ClearAll</ListGroup.Item>

                {/* Section 3: Undo/Redo */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Undo/Redo
                </div>
                <ListGroup.Item action onClick={(e) => undoLast(e)} disabled={undoStack.length === 0}>Undo</ListGroup.Item>
                <ListGroup.Item action onClick={(e) => redoLast(e)} disabled={redoStack.length === 0}>Redo</ListGroup.Item>

                {/* Section 4: Selection */}
                <div className="bg-light px-3 py-2 fw-bold small text-uppercase border-bottom border-top mt-2">
                    Selection
                </div>
                <ListGroup.Item action onClick={() => setShapeType('rectangle-selection')}>Select (rect)</ListGroup.Item>
                <ListGroup.Item action onClick={() => setShapeType('freehand-selection')}>Select (freehand)</ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between align-items-center bg-light">
                    <label htmlFor="select-vtx-toggle" style={{ cursor: 'pointer', marginBottom: 0 }}>
                        Select Vertices
                    </label>
                    <Form.Check
                        type="switch"
                        id="select-vtx-toggle"
                        checked={selectVertices}
                        onChange={() => toggleSelectVertices()}
                    />
                </ListGroup.Item>

                {/* Section 5: View */}
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
            <Col className="position-relative bg-white">
                <div ref={drawingAreaRef} id="drawing-area">
                    {svgIsReady && drawInstance.current && (
                        <>
                        <SvgGrid svgRef={drawInstance.current.node as SVGSVGElement} showGrid={showGrid} size={50} />
                        {selectVertices && (
                            <SvgPoints
                                svgRef={drawInstance.current.node as SVGSVGElement}
                                selectedShapeIds={filteredSelectedShapeIds}
                                filteredShapes={filteredShapes}
                                selectedPtsRef={selectedPtsRef}
                            />
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
                        onClick={(e) => selectShapes(e.nativeEvent, [[id, [], []]])}
                        onMouseEnter={() => setHoveredShapeId(id)}
                        onMouseLeave={() => setHoveredShapeId(-1)}
                        className={`p-3 shape-list-item ${hoveredShapeId === id ? 'hovered' : ''} ${selectedShapeIds.map(([sid]) => sid).includes(id) ? 'selected' : ''} ${shape.shapeClass}`}>
                    <Stack gap={2}>
                        <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-bold fs-5">{id}</span>
                        <Badge bg="secondary">{shape.shapeInstance?.type ?? 'Shape'}</Badge>
                        </div>
                        <div className="d-flex gap-2 mt-2">
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="flex-grow-1"
                            onClick={() => merge_shapes([id])}
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
    );
}

export default P_Shapes

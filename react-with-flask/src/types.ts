import type { Polygon } from '@svgdotjs/svg.js';

export type Point = [number, number];
export type ShapeId = string;

/** Tuple: [shapeId, selected points coords, selected point indices] */
export type SelectedShapeEntry = [ShapeId, Point[], number[]];

/** Polygon extended with svg.js internal point array and svg.draw.js method */
export interface SvgPolygon extends Polygon {
  _array: Point[];
  draw(action?: string): this;
}

export interface ShapeRecord {
  id: ShapeId;
  shapeClass: string;
  shapeInstance: SvgPolygon;
}

export type ShapesDict = Record<ShapeId, ShapeRecord>;

export interface ShapeObjItem {
  shapeInstance: SvgPolygon;
  shapeClass: string;
  id: ShapeId;
}

export type OriginType = 'action' | 'undo' | 'redo';

export type UndoRedoAction =
  | { type: 'CREATE_SHAPES'; data: { shapeObjArr: ShapeObjItem[] } }
  | { type: 'DELETE_SHAPES'; data: { ids: ShapeId[]; shapeInstances: SvgPolygon[] } }
  | { type: 'UPDATE_SHAPES'; data: { shapeUpdateArr: ShapeObjItem[]; oldShapeArr: ShapeRecord[] } }
  | { type: 'ROTATE_ALL'; data: { angle: number } }
  | { type: 'CLEAR_ALL'; data: { shapes: ShapesDict } };

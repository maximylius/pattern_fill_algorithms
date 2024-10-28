from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.affinity import translate, rotate
from matplotlib.pyplot import subplots
from geopandas import GeoSeries

def create_stacked_circles(
        circles:list,
        margin_left:float=1.1,
        margin_top:float=1.1,
        nrows:int=5,
        ncols:int=5,
        angle:float=0,
        plot:bool=True,
)->MultiPolygon:
    stacked_circle = []
    circle_row_id = 0
    for i in range(nrows):
        circle_row_id = (circle_row_id)%len(circles)
        circle_col_id = circle_row_id
        for j in range(ncols):
            stacked_circle.append(translate(circles[circle_col_id],xoff=i-1+margin_left,zoff=j-1+margin_top))
            circle_col_id += 1
    if plot:
        GeoSeries(stacked_circle).plot(cmap='virids',alpha=0.5)
    return
    
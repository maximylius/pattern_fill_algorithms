from shapely.geometry import Polygon, MultiPolygon
from shapely.affinity import translate, rotate
from geopandas import GeoSeries
from math import pi,sin,cos

# create grid with repeating increasing width
def create_circle_segments(
        n:int=10, 
        circle:float=0.1,
        angle:float=0,
        every_nth:list=[],
        remove_or_keep:str='remove',# or 'keep'
        plot:bool=True
        )->MultiPolygon:
    """
    if 
    """
    slices = [Polygon([
        (0,0),
        (2*sin(i/n * 360 * pi / 180 ), 2*cos(i/n * 360 * pi / 180 )),
        (2*sin((i+1)/n * 360 * pi / 180 ), 2*cos((i+1)/n * 360 * pi / 180 ))
        ]) for i in range(n) if (
            (not any((i%nth)==0 for nth in every_nth)) if remove_or_keep=='remove' else
            any((i%nth)==0 for nth in every_nth))]
    
    gs = GeoSeries(slices)

    nc=max(n,360)
    crcl = Polygon(
        [(sin((i+1)/nc * 360 * pi / 180 ), cos((i+1)/nc * 360 * pi / 180 ))
        for i in range(nc)])
    gs = gs.intersection(crcl)

    if circle:
        crcl = Polygon(
            [(circle*sin((i+1)/nc * 360 * pi / 180 ), circle*cos((i+1)/nc * 360 * pi / 180 ))
            for i in range(nc)])
        gs = gs.difference(crcl)

    poly = gs.unary_union
    poly.buffer(0)
    poly = rotate(poly,angle)

    
    if plot:
        GeoSeries([rotate(geom,angle,origin=(0,0)) for geom in gs]).plot(cmap='viridis', alpha=.5)
        # GeoSeries([poly]).plot(color='black')
    
    return poly
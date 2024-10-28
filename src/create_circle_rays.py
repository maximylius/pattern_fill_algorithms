from shapely.geometry import Polygon, MultiPolygon
from shapely.affinity import translate, rotate
from geopandas import GeoSeries
from math import pi,sin,cos

# create grid with repeating increasing width
def create_circle_rays(
        n:int=10, 
        diff:bool=False,
        circle:float=0.1,
        angle:float=0,
        width=.05,
        plot:bool=True
        )->MultiPolygon:
    slices = [Polygon([
        (0,0),
        (2*sin(i/n * 360 * pi / 180 ), 2*cos(i/n * 360 * pi / 180 )),
        (2*sin((i+1)/n * 360 * pi / 180 ), 2*cos((i+1)/n * 360 * pi / 180 ))
        ]) for i in range(n)]
    
    rays = [Polygon([
        (
            0-width*.5*sin((i/n+.25) * 360 * pi / 180 ),
            0-width*.5*cos((i/n+.25) * 360 * pi / 180 )),
        (
            0+width*.5*sin((i/n+.25) * 360 * pi / 180 ),
            0+width*.5*cos((i/n+.25) * 360 * pi / 180 )),
        (
            2*sin(i/n * 360 * pi / 180 )+width*.5*sin((i/n+.25) * 360 * pi / 180 ), 
            2*cos(i/n * 360 * pi / 180 )+width*.5*cos((i/n+.25) * 360 * pi / 180 )),
        (
            2*sin(i/n * 360 * pi / 180 )-width*.5*sin((i/n+.25) * 360 * pi / 180 ), 
            2*cos(i/n * 360 * pi / 180 )-width*.5*cos((i/n+.25) * 360 * pi / 180 )),
        ]) for i in range(n)]
    
    gs = GeoSeries(slices)
    gs = GeoSeries(rays)
    nc=max(n,360)
    crcl = Polygon(
        [(sin((i+1)/nc * 360 * pi / 180 ), cos((i+1)/nc * 360 * pi / 180 ))
        for i in range(nc)])
    gs = gs.intersection(crcl)
    # gs = gs.difference(crcl)
    
   
    if circle:
        crclInner = Polygon(
            [(circle*sin((i+1)/nc * 360 * pi / 180 ), circle*cos((i+1)/nc * 360 * pi / 180 ))
            for i in range(nc)])
        gs = gs.difference(crclInner)
        crcl = crcl.difference(crclInner)

    if plot:
        GeoSeries([rotate(geom,angle,origin=(0,0)) for geom in gs]).plot(cmap='viridis', alpha=.5)
        
    poly = gs.unary_union
    # rotate poly
    poly  = rotate(poly,angle)
    # return rays not circle without rays
    return poly
    
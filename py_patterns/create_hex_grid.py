from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.affinity import translate, rotate
from matplotlib.pyplot import subplots
from geopandas import GeoSeries

def create_hex_grid(
        nrows:int=12, 
        ncols:int=6, 
        gap=0.1, 
        angle:float=45, 
        scale:float=1, 
        origin:tuple=(0,0), 
        plot:bool=True
        ) -> MultiPolygon:
    ox,oy=origin
    w,h=(scale*2,scale*3**.5)
    c_x, c_y = (0,0)
    fill = 1-gap

    center_point = Point(origin[0]+ncols*3/4*w, origin[1]+nrows/4*h)
    
    x_step = .75*w
    y_step = .5*h
    

    hxs = []
    for i in range(nrows):
        for j in range(ncols):
            if not (i%2==1 and j == ncols-1): 
                xoff = j*2*x_step+int(i%2==1)*x_step
                yoff = i*y_step
                
                fill = (1-gap)**(1+i/nrows+j/ncols)**2
                fill = (1-gap)**((2-abs(nrows/2-i)/nrows-abs(ncols/2-j)/ncols)**3)
                fill = (1-gap)**((1+abs(nrows/2-i)/nrows+abs(ncols/2-j)/ncols)**3)
                fill = (1-0.6*(abs(nrows/2-i)/nrows*abs(ncols/2-j)/ncols+abs(nrows/2-i)/nrows+abs(ncols/2-j)/ncols)**2)**(.8)
                
                hx = Polygon([
                    (xoff+ c_x-fill*.25*w, yoff+ c_y-fill*0.5*h),
                    (xoff+ c_x+fill*.25*w, yoff+ c_y-fill*0.5*h),
                    (xoff+ c_x+fill*.50*w, yoff+ c_y+fill*0.0*h),
                    (xoff+ c_x+fill*.25*w, yoff+ c_y+fill*0.5*h),
                    (xoff+ c_x-fill*.25*w, yoff+ c_y+fill*0.5*h),
                    (xoff+ c_x-fill*.50*w, yoff+ c_y+fill*0.0*h)
                    ])   
                hxs.append(hx)
    
    multipoly = GeoSeries(hxs).unary_union
    multipoly = rotate(multipoly, angle)

    if plot:
        GeoSeries(hxs).plot(cmap='viridis')
        # fig, ax = subplots()
        # GeoSeries([multipoly]).plot(ax=ax,color='black')
        # GeoSeries([center_point]).plot(ax=ax,color='red')
    return multipoly

from shapely.geometry import Polygon, MultiPolygon
from shapely.affinity import translate, rotate
from geopandas import GeoSeries

# create grid with repeating increasing width
def create_shaded_grid(
        angle:float=45, 
        scale:float=1,
        origin:tuple=(0,0), 
        nreps_h:int=3, 
        nreps_v:int=3, 
        ncols:int=11, 
        nrows:int=11, 
        min_width:float=0.1,
        max_width:float=0.4,
        start_width:float=0.2,
        wiggle_penalty:float=0.5,
        color_penalty:float=0.5,
        smothness:float=0.5,
        pixels=[[]],

        plot:bool=True
        )->MultiPolygon:
    """
    This function creates a grid and then adjusts the border widths s.t. 
    the ratio of border area to are in grid cells matches the pattern fill value s.t.
    the mean pixel rgb matches the mean pixel rgb of the original

    decisions to be taken:
    should the border be symmetric along their axis or can one be thicker than the other?
    lets say symmetric for now.
    take point at half way of each edge. 

    # first step get value for each region.
    # set all width to standard witdh
    # use iterations to minimize penalty function

    # penalty function
    sum([wiggle_penalty_fun(line) for line in lines])
    regression: fill_value_i = width_i_top+width_i_bottom+width_i_left+width_i_right
    maybe use 
    
    """
    dx,dy = 1*scale,1*scale
    w=0.01
    lines = []
    def get_thickness (n,N,w=w):
        return w*(1+5*n/N)
    
    for k in range(nreps_h):
        for n in range(nreps_v):
            for i in range(ncols):
                prg = i/(ncols-1)
                thickness = get_thickness(i, ncols)
                x1 = min(prg+.5*thickness, 1+.5*w)*dx
                x2 = max(prg-.5*thickness, (i-1)/(ncols-1))*dx
                lines.append(Polygon([
                    (x1+k*dx, (1+.5*w)*dy+n*dx),
                    (x1+k*dx, (0-.5*w)*dy+n*dx),
                    (x2+k*dx, (0-.5*w)*dy+n*dx),
                    (x2+k*dx, (1+.5*w)*dy+n*dx)
                    ]))
                
            for j in range(nrows): 
                prg = j/(nrows-1)
                thickness = get_thickness(j, nrows)
                y1 = max(prg-.5*thickness, 0-.5*w)*dy
                y2 = min(prg+.5*thickness, 1+.5*w)*dy
                lines.append(Polygon([
                    ((0-.5*w)*dx+k*dx, y1+n*dy),
                    ((1+.5*w)*dx+k*dx, y1+n*dx),
                    ((1+.5*w)*dx+k*dx, y2+n*dx),
                    ((0-.5*w)*dx+k*dx, y2+n*dx)
                    ]))
            
            
    poly = GeoSeries(lines).unary_union
    poly = rotate(poly,angle)

    if plot:
        # GeoSeries(lines).plot(cmap='viridis', alpha=.5)
        GeoSeries([poly]).plot(color='black')
    
    return poly
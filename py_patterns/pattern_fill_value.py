from numpy import linspace, exp
from matplotlib.pyplot import subplots


def calc_color_distance(rgb1, rgb2)->float:
    """
    Returns color distance as float [0, 764.8339663572415]
    approximation without needed to change colorspace, taken from: https://stackoverflow.com/a/9085524
    """
    r1,g1,b1 = rgb1
    r2,g2,b2 = rgb2
    rmean = (r1 + r2)/2
    r = r1 - r2
    g = g1 - g2
    b = b1 - b2

    return ((((512+rmean)*r**2)/2**8) + 4*g**2 + (((767-rmean)*b**2)/2**8))**.5


def color_distance_to_pattern_fill_value(
        color_distance:float,
        transform=(lambda v: 1/(1+math.exp(7-v*20))),
        fill_val_floor= 0.05,
        fill_val_ceil= 0.95,
        plot=False,
):
    """
    Converts color distance into pattern_fill_value:
    small distance -> small fill value
    large distance -> large fill value
    
    """
    max_color_distance = 764.8339663572415
    val = transform(color_distance/max_color_distance)
    if plot:
        fig, ax = subplots(figsize=(4,0.75))
        xs = linspace(0,1,100)
        ax.hlines(fill_val_floor, 0, 1, color='#ddd')
        ax.hlines(fill_val_ceil, 0, 1, color='#ddd')
        ax.plot(xs, [transform(x) for x in xs])
        ax.vlines(val, 0, 1, color='red')
        ax.set_ylim(-0.005,1.005)
        ax.set_xlim(-0.005,1.005)
    
    # ensure value is within bounds
    # val = min(max(0,val),1)
    
    # if value below floor set to 0
    if val <= fill_val_floor:
        val = 0
    # if value below floor set to 0
    elif val >= fill_val_ceil:
        val = 1
        
    return val


def rgb_to_pattern_fill_value (
        rgb_pixel:tuple,
        rgb_compare:tuple,
        transform=(lambda v: 1/(1+exp(7-v*20))),
        fill_val_floor= 0.05,
        fill_val_ceil= 0.95,
        plot=False,
)->float:
        """
        
        """
        
        return color_distance_to_pattern_fill_value(
                color_distance=calc_color_distance(rgb_pixel, rgb_compare),
                transform=transform,
                fill_val_floor=fill_val_floor,
                fill_val_ceil=fill_val_ceil,
                plot=plot,
        )
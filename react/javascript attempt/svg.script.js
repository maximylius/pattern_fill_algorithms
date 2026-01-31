
new SVG('rect').size('100%', '100%').rect().draw().attr('stroke-width',1).attr('fill','none');
new SVG('rect_transformed').size('100%', '100%').rect().draw().attr('stroke-width',1).attr('fill','none').scale(4).rotate(45);
var poly1 = new SVG('polygon').size('100%', '100%').polygon().draw().attr('stroke-width',1).attr('fill','none');
new SVG('ellipse').size('100%', '100%').ellipse().draw().attr('stroke-width',1).attr('fill','none');
new SVG('circle').size('100%', '100%').circle().draw().attr('stroke-width',1).attr('fill','none');
var poly2 = new SVG('polygonGrid').size('100%', '100%').polygon().draw({snapToGrid:20}).attr('stroke-width',1).attr('fill','none');

var poly3 = new SVG('polygonGridOnCtrl').size('100%', '100%').polygon().draw().attr('stroke-width',1).attr('fill','none');

poly3.on('drawstart', function(e){
    document.addEventListener('keydown', function(e){
        if(e.keyCode == 13){
            poly3.draw('done');
            poly3.off('drawstart');
        }
        if(e.keyCode == 17){
            poly3.draw('param', 'snapToGrid', 20);
        }
    });
    
    document.addEventListener('keyup', function(e){
        poly3.draw('param', 'snapToGrid', 1);
    });
});

var drawing = new SVG('rectNoClick').size('100%', '100%');
var rect = drawing.rect().attr('stroke-width',1).attr('fill','none');
drawing.on('mousedown', function(e){
    rect.draw(e);
}, false);

drawing.on('mouseup', function(e){
    rect.draw('stop', e);
}, false);

poly1.on('drawstart', function(e){
    document.addEventListener('keydown', function(e){
        if(e.keyCode == 13){
            poly1.draw('done');
            poly1.off('drawstart');
        }
    });
});

poly2.on('drawstart', function(e){
    document.addEventListener('keydown', function(e){
        if(e.keyCode == 13){
            poly2.draw('done');
            poly2.off('drawstart');
        }
    });
});


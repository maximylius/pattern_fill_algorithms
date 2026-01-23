import uuid
from shiny import App, ui, render, reactive
from shinywidgets import output_widget, render_widget
from ipyleaflet import Map, GeomanDrawControl, Polygon as LeafletPolygon
from shapely.geometry import shape

# Styling constants
NORMAL_STYLE = {"color": "#3388ff", "fillOpacity": 0.2, "weight": 2}
HOVER_STYLE = {"color": "#ff4444", "fillOpacity": 0.6, "weight": 4}

app_ui = ui.page_sidebar(
    ui.sidebar(
        ui.h3("Drawn Shapes"),
        ui.output_ui("shape_list"),
        ui.input_action_button("refresh_shapes", "Refresh List")
    ),
    ui.page_fluid(
        ui.h2("Interact with Polygons via List"),
        ui.output_text("refresh_count"),
        output_widget("map"),
    )
)

def server(input, output, session):
    # Dictionary to store {id: ipyleaflet_layer_object}
    drawn_layers = reactive.Value({})
    refresh_counter = reactive.Value(0)
    m1 = reactive.Value(None)

    @render_widget
    def map():
        m = Map(center=(52.5, 13.4), zoom=12)
        m1.set(m)
        draw_control = GeomanDrawControl(drawFreehand=True)
        
        def handle_draw(target, action, geo_json):
            if action == 'create' or True:
                # 1. Convert to Shapely for data (optional)
                poly_geom = shape(geo_json['geometry'])
                
                # 2. Create a stable Leaflet Layer from the drawn coordinates
                # ipyleaflet uses (lat, lon)
                coords = [(p[1], p[0]) for p in geo_json['geometry']['coordinates'][0]]
                new_layer = LeafletPolygon(locations=coords, **NORMAL_STYLE)
                
                # 3. Store with a unique ID
                poly_id = str(uuid.uuid4())[:8]
                current = drawn_layers.get().copy()
                current[poly_id] = new_layer
                print("current layers:", current)
                drawn_layers.set(current)
                
                # Add to map and remove the "temporary" drawing ghost
                m.add_layer(new_layer)
        
        draw_control.on_draw(handle_draw)
        m.add_control(draw_control)
        return m

    @render.ui
    def shape_list():
        refresh_counter()
        layers = drawn_layers.get()
        if not layers:
            return ui.p("No shapes yet."+str(layers))
        
        return ui.div(
            [ui.div(
                f"Polygon {id_}",
                onmouseover=f"Shiny.setInputValue('hover_id', '{id_}')",
                onmouseout="Shiny.setInputValue('hover_id', null)",
                style="padding: 8px; border-bottom: 1px solid #ddd; cursor: pointer;"
            ) for id_ in layers.keys()]
        )
    @reactive.Effect
    def refresh_count():
        return str(refresh_counter())
    # Effect to handle highlighting when hovering the list
    @reactive.Effect
    @reactive.event(input.hover_id)
    def highlight_shape():
        target_id = input.hover_id()
        layers = drawn_layers.get()
        
        for id_, layer in layers.items():
            if id_ == target_id:
                layer.color = HOVER_STYLE["color"]
                layer.fill_opacity = HOVER_STYLE["fillOpacity"]
                layer.weight = HOVER_STYLE["weight"]
            else:
                layer.color = NORMAL_STYLE["color"]
                layer.fill_opacity = NORMAL_STYLE["fillOpacity"]
                layer.weight = NORMAL_STYLE["weight"]
    @reactive.Effect
    @reactive.event(input.hover_id)
    def refresh_shapes():
        print("m1",m1())
        drawn_layers.set(m1().layers)
        refresh_counter.set(refresh_counter() + 1)

app = App(app_ui, server)
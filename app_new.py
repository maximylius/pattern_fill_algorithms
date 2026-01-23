from shiny import App, render, ui, reactive
import base64

app_ui = ui.page_navbar(
    ui.nav_panel(
        "png_to_shape",
        ui.tags.style("""
            .img-container { 
                height: 100vh; 
                width: 100%; 
                background-color: #f7f7f7;
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: auto;
                position: relative;
            }
            .img-wrapper {
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .img-wrapper img {
                max-height: 100vh;
                max-width: 100%;
                object-fit: contain;
            }
        """),
        ui.page_sidebar(
            ui.sidebar(
                ui.input_action_button("crop_btn", "Apply Crop", class_="btn-primary"),
                ui.hr(),
                ui.p("Zoom Controls:", class_="fw-bold"),
                ui.input_action_button("zoom_in_btn", "Zoom In", class_="btn-sm btn-success"),
                ui.input_action_button("zoom_out_btn", "Zoom Out", class_="btn-sm btn-warning"),
                ui.input_action_button("zoom_fit_btn", "Fit to Window", class_="btn-sm btn-info"),
                ui.output_text("zoom_display"),
                ui.hr(),
                ui.input_select("dropdown", "Options", choices=["Mode A", "Mode B"]),
                ui.input_slider("param_slider", "Parameter", 0, 100, 50),
                ui.input_slider("opacity_slider", "Layer Opacity", 0, 1, 0.5, step=0.1),
                position="right"
            ),
            ui.input_file("file_input", "Open File (PNG/JPG)", accept=[".png", ".jpg"]),
            ui.output_ui("image_container"),
        )
    ),
    ui.nav_panel("Second Window", ui.h2("Analysis Page")),
    title="Image Cropper & Processor"
)

def server(input, output, session):
    # Reactive value for current zoom level
    zoom_level = reactive.Value(1.0)
    
    @render.ui
    def image_container():
        file = input.file_input()
        current_zoom = zoom_level()
        
        if file is None:
            return ui.div("Please upload a file to begin.", class_="img-container")
        
        with open(file[0]["datapath"], "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        
        # Create image with dynamic scaling
        return ui.div(
            ui.div(
                ui.img(
                    id="zoomable-image",
                    src=f"data:image/png;base64,{encoded}",
                    style=f"transform: scale({current_zoom}); transform-origin: center center; transition: transform 0.2s ease-out;"
                ),
                class_="img-wrapper"
            ),
            class_="img-container",
            id="img-container"
        )
    
    @render.text
    def zoom_display():
        zoom = zoom_level()
        return f"Zoom: {zoom:.1f}x"
    
    @reactive.Effect
    def handle_zoom_in():
        if input.zoom_in_btn() > 0:
            current = zoom_level()
            new_zoom = min(5, current + 0.2)
            zoom_level.set(new_zoom)
    
    @reactive.Effect
    def handle_zoom_out():
        if input.zoom_out_btn() > 0:
            current = zoom_level()
            new_zoom = max(0.5, current - 0.2)
            zoom_level.set(new_zoom)
    
    @reactive.Effect
    def handle_zoom_fit():
        if input.zoom_fit_btn() > 0:
            zoom_level.set(1.0)
    
    @reactive.Effect
    def reset_zoom_on_file_change():
        file = input.file_input()
        if file is not None:
            zoom_level.set(1.0)

app = App(app_ui, server)

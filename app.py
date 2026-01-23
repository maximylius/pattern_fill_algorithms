from shiny import App, render, ui, reactive
import base64
import struct

app_ui = ui.TagList(
    ui.head_content(
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
            #zoomable-image {
                max-height: 100vh;
                max-width: 100%;
                object-fit: contain;
                --zoom-scale: 1.3;
                transform: scale(var(--zoom-scale));
                transform-origin: center center;
                transition: transform 2s ease-in-out;
            }
            """, id="style2"),
        ui.tags.script("""
            $(document).on('shiny:connected', function() {
                function updateContainerDims() {
                    var container = document.getElementById("img-container");
                    console.log("Updating container dims");
                    if (container) {
                        Shiny.setInputValue("container_dims", {
                            width: container.offsetWidth,
                            height: container.offsetHeight
                        });
                    }
                }
                Shiny.addCustomMessageHandler("update_zoom", function(data) {
                    var img = document.getElementById("zoomable-image");
                    console.log("Updating zoom to:", data.zoom);
                    if (img) {
                        img.style.setProperty('--zoom-scale', data.zoom);
                        img.style.transform = 'scale(' + data.zoom + ')';
                    }
                });
                   
                updateContainerDims();
                $(window).on('resize', updateContainerDims);
                console.log("Shiny connected and resize handler set.");
                const container = document.getElementById("img-container");
                // Listen for mouse wheel events on the image container
                container.addEventListener('wheel', function(e) {
                    // Prevent the whole page from scrolling
                    e.preventDefault();

                    // Determine zoom direction: deltaY < 0 is scroll up (Zoom In)
                    let direction = e.deltaY < 0 ? 0.1 : -0.1;
                    
                    // Send the change to Shiny
                    Shiny.setInputValue("wheel_zoom_change", {
                        change: direction,
                        nonce: Math.random() // Ensure every scroll triggers an update
                    });
                }, { passive: false });
                
            });
            """)
    ),
    ui.page_navbar(
        ui.nav_panel(
            "png_to_shape",
            # ui.div(ui.tags.style("""
            #     #zoomable-image {
            #         transform: scale(1.23);
            #     }
            # """)),
            ui.output_ui("zoom_style"),
            ui.tags.style(ui.output_text("zoom_style2")),
            ui.div(ui.output_ui("zoom_style3")),
            ui.page_sidebar(
                ui.sidebar(
                    ui.input_action_button("crop_btn", "Apply Crop", class_="btn-primary"),
                    ui.hr(),
                    ui.p("Zoom Controls:", class_="fw-bold"),
                    ui.input_action_button("zoom_in_btn", "Zoom In", class_="btn-sm btn-success"),
                    ui.input_action_button("zoom_out_btn", "Zoom Out", class_="btn-sm btn-warning"),
                    ui.input_action_button("zoom_fit_btn", "Fit to Window", class_="btn-sm btn-info"),
                    ui.output_text("zoom_display"),
                    ui.output_text("pixel_display"),
                    ui.hr(),
                    ui.input_select("dropdown", "Options", choices=["Mode A", "Mode B"]),
                    ui.input_slider("param_slider", "Parameter", 0, 100, 50),
                    ui.input_slider("opacity_slider", "Layer Opacity", 0, 1, 0.5, step=0.1),
                    position="right"
                ),
                ui.input_file("file_input", "Open File (PNG/JPG)", accept=[".png", ".jpg"]),
                ui.div(
                    ui.output_ui("image_wrapper"),
                    class_="img-container",
                    id="img-container"
                ),
            ),
        ),
        ui.nav_panel("Second Window", ui.h2("Analysis Page")),
        title="Image Cropper & Processor"
    )
)

def server(input, output, session):
    # Reactive value for current zoom level
    zoom_level = reactive.Value(1.0)
    png_width = reactive.Value(1)
    png_height = reactive.Value(1)
    calculated_zoom = reactive.Value(1.0)
    
    @render.ui
    def image_wrapper():
        file = input.file_input()
        
        if file is None:
            return ui.div("Please upload a file to begin.")
        
        with open(file[0]["datapath"], "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        
            f.seek(0)  # Reset to beginning
            head = f.read(32)
            # --- PNG Handling ---
            # Signature: \x89PNG\r\n\x1a\n
            if head.startswith(b'\x89PNG\r\n\x1a\n'):
                # Dimensions are 4-byte big-endian ints starting at offset 16
                width, height = struct.unpack('>II', head[16:24])
            # --- JPEG/JPG Handling ---
            # Signature: \xff\xd8
            elif head.startswith(b'\xff\xd8'):
                try:
                    f.seek(0)
                    size = 2
                    ftype = 0
                    # Scan for SOFn markers (0xc0 - 0xcf, excluding 0xc4, 0xc8, 0xcc)
                    while not 0xc0 <= ftype <= 0xcf or ftype in [0xc4, 0xc8, 0xcc]:
                        f.seek(size, 1)
                        byte = f.read(1)
                        while ord(byte) == 0xff: # Skip padding bytes
                            byte = f.read(1)
                        ftype = ord(byte)
                        size = struct.unpack('>H', f.read(2))[0] - 2
                    

                    # We are at a SOFn block; skip precision byte
                    f.seek(1, 1)
                    # Read 2-byte big-endian height, then width
                    height, width = struct.unpack('>HH', f.read(4))
                except Exception:
                    width, height = 1, 1 # Fallback on error

            png_width.set(width)
            png_height.set(height)
            dims = input.container_dims()
            print("0dims width height", dims['width'], dims['height'])
            if dims and dims["width"] > 0 and dims["height"] > 0:

                    best_zoom = min(dims['width'] / png_width(), dims['height'] / png_height())
                    calculated_zoom.set(best_zoom)
                    print("calculated zoom on file change:", best_zoom, dims['width'] / png_width(), dims['height'] / png_height())
                    zoom_level.set(best_zoom)
            # zoom_level.set(calculated_zoom())
            # Return only the inner wrapper - outer container is in UI
            return ui.img(
                    id="zoomable-image",
                    src=f"data:image/png;base64,{encoded}",
                    style=f"--zoom-scale: {zoom_level()}"# ;
                )
        
    
    
    @render.text
    def zoom_display():
        zoom = zoom_level()
        return f"Zoom: {zoom:.1f}x"
    
    @render.text
    def pixel_display():
        if png_width()>1 and png_height()>1:
            return f"{png_width():.0f}x{png_height():.0f}"
        return ""
    
    @reactive.Effect
    def zoom_style():
        print("zoom update1", zoom_level())
        session.send_custom_message("update_zoom", {"zoom": zoom_level()})
        # Update the CSS variable globally or for a specific ID
        return ui.div(ui.tags.style(f"""#zoomable-image {{
            transform: scale({zoom_level()});
        }}"""))
    
    @reactive.Effect
    def zoom_style2():
        print("zoom update2", zoom_level())
        # session.send_custom_message("update_zoom", {"zoom": zoom})
        # Update the CSS variable globally or for a specific ID
        return f"""#zoomable-image {{
            transform: scale({zoom_level()});
        }}"""
    @reactive.Effect
    def zoom_style3():
        print("zoom update3", zoom_level())
        # session.send_custom_message("update_zoom", {"zoom": zoom})
        # Update the CSS variable globally or for a specific ID
        
        return ui.TagList(
            ui.tags.style(f"""#zoomable-image {{
                transform: scale({zoom_level()});
            }}""")
        )
    
    @reactive.Effect
    @reactive.event(input.wheel_zoom_change)
    def handle_wheel_zoom():
        # Get the change amount from the JS message
        data = input.wheel_zoom_change()
        change = data["change"] * 1
        print("data",data)
        # Update the zoom level with bounds (e.g., 0.1x to 5.0x)
        current = zoom_level()
        new_zoom = max(0.1, min(5.0, current + change))
        zoom_level.set(new_zoom)
        
    @reactive.Effect
    @reactive.event(input.zoom_in_btn)
    def handle_zoom_in():
        current = zoom_level()
        new_zoom = min(5.0, current + 0.2)
        # print("new_zoom_in:", new_zoom, "current:", current)
        zoom_level.set(new_zoom)
    
    @reactive.Effect
    @reactive.event(input.zoom_out_btn)
    def handle_zoom_out():
        current = zoom_level()
        new_zoom = max(0.2, current - 0.2)
        print("new_zoom_out:", new_zoom, "current:", current)
        zoom_level.set(new_zoom)
    
    @reactive.Effect
    @reactive.event(input.zoom_fit_btn)
    def handle_zoom_fit():
        print("calculated_zoom():", calculated_zoom())
        dims = input.container_dims()
        if dims and dims["width"] > 0 and dims["height"] > 0:
            zoom_level.set(calculated_zoom())
        else:
            zoom_level.set(1.4)

    @reactive.Effect
    def reset_zoom_on_file_change():
        file = input.file_input()
        if file is not None:
            dims = input.container_dims()
            with reactive.isolate():
                print("dims width height", dims['width'], dims['height'])
                was_calculated_zoom = zoom_level() == calculated_zoom()
                if dims and dims["width"] > 0 and dims["height"] > 0:
                    best_zoom = min(dims['width'] / png_width(), dims['height'] / png_height())
                    calculated_zoom.set(best_zoom)
                    print("calculated zoom on resize:", best_zoom)
                    # zoom_level.set(calculated_zoom)
                    # if was_calculated_zoom:
                    #     zoom_level.set(calculated_zoom)
                # else:
                #     zoom_level.set(1.0)


app = App(app_ui, server)
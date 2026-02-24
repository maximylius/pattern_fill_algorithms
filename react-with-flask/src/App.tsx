import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar, Nav, NavDropdown, Container, Row } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import P_Shapes from './P_Shapes';
import P_ImageProcessing from './P_ImageProcessing';
import P_Repetition from './P_Repetition';
import P_Stencil from './P_Stencil';

//  TODO: make functions accept the creation and deletion of multiple shapes at once for better undo/redo performance
function App() {
  return (
    <BrowserRouter>
      <header>
        <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
          <Container>
            <Navbar.Brand href="/">PatternCreator</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link href="/image">Image Processing</Nav.Link>
                <Nav.Link href="/shapes">Shape Creation</Nav.Link>
                <Nav.Link href="/repetition">Repetiton Style</Nav.Link>
                <Nav.Link href="/stencil">Stencil creation</Nav.Link>
                <NavDropdown title="Services" id="basic-nav-dropdown">
                  <NavDropdown.Item href="#action/1">Design</NavDropdown.Item>
                  <NavDropdown.Item href="#action/2">Entwicklung</NavDropdown.Item>
                  <NavDropdown.Divider />
                  <NavDropdown.Item href="#action/3">Support</NavDropdown.Item>
                </NavDropdown>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>
      <div className="editor-container" style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
        <Row className="flex-grow-1">
         <Routes>
          <Route path="" element={<P_Shapes />} />
          <Route path="/image/*" element={<P_ImageProcessing />} />
          <Route path="/shapes/*" element={<P_Shapes />} />
          <Route path="/repetition/*" element={<P_Repetition />} />
          <Route path="/stencil/*" element={<P_Stencil />} />
         </Routes>
        </Row>
      </div>
    </BrowserRouter>
  )
}

export default App

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.draw.js';
import { Button, Navbar, Nav, NavDropdown, Container, ListGroup, Stack, Badge, Row, Col, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Für Dropdowns, Modals etc.
//  TODO: make functions accept the creation and deletion of multiple shapes at once for better undo/redo performance
function P_Repetition() {
  
  

  return (
    <>
      {/* LEFT PANEL */}
        <Col md={3} lg={2} className="bg-light border-end p-3 shadow-sm">
            <h5 className="mb-4">Tools</h5>
            <ListGroup variant="flush">
            </ListGroup>
        </Col>
        
        {/* CANVAS */}
        <Col md={6} lg={8} className="position-relative bg-white">
            <h1 className="mb-4">Repetition Style</h1>
        </Col>

        {/* RIGHT PANEL */}
        <Col md={3} lg={2} className="position-relative bg-light border-end p-3 shadow-sm">
            <h5 className="mb-4">Shapes</h5>
            <ListGroup variant="flush" className="border rounded">
            </ListGroup>
        </Col>
    </>
  )
}

export default P_Repetition

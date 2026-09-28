import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Markets } from './pages/Markets';
import { ActionDetail } from './pages/ActionDetail';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Markets />} />
        <Route path="/action/:symbol" element={<ActionDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

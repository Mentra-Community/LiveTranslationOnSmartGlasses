import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TranslationTranscript } from './screens/TranslationTranscript';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TranslationTranscript />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
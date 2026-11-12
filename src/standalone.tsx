import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/noto-sans-kr';
import './style.css';
import { CardMakerApp } from './main';

const node=document.getElementById('root');
if(!node)throw new Error('CARD STUDIO root missing');
createRoot(node).render(<React.StrictMode><CardMakerApp/></React.StrictMode>);

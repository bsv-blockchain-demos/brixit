// src/pages/About.tsx
import React from 'react';
import { WebviewPage } from '../components/common/WebviewPage';

const About = () => (
  <WebviewPage
    url="https://www.bionutrient.org/brixit"
    title="About BRIX, from the Bionutrient Food Association"
    linkLabel="Open on bionutrient.org"
  />
);

export default About;

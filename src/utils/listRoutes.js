import express from 'express';
import listEndpoints from 'express-list-endpoints';
import { createTestApp } from '../../tests/helpers/testApp.js'; 

const app = createTestApp(); 

const endpoints = listEndpoints(app);

console.log('\n RUTAS DISPONIBLES:');
console.log('=====================================\n');

endpoints.forEach(endpoint => {
  endpoint.methods.forEach(method => {
    console.log(`${method.padEnd(7)} ${endpoint.path}`);
  });
});

console.log(`\nEndpoints: ${endpoints.reduce((total, ep) => total + ep.methods.length, 0)}\n`);
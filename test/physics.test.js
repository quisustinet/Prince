import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,step} from '../src/physics.js';
const tick=(p,input={},n=1)=>{for(let i=0;i<n;i++)step(p,1/120,{left:false,right:false,jump:false,...input});};
test('postać ląduje na platformie i płynnie przyspiesza',()=>{const p=spawn();tick(p,{},20);assert.equal(p.grounded,true);tick(p,{right:true});assert.ok(p.vx>0&&p.vx<255);tick(p,{right:true},60);assert.ok(p.x>180);});
test('skok unosi postać i pozwala wrócić na platformę',()=>{const p=spawn();tick(p,{},20);tick(p,{jump:true});assert.ok(p.vy<0);assert.ok(p.y<370);tick(p,{},120);assert.equal(p.y,370);assert.equal(p.grounded,true);});
test('nie można skakać ponownie w powietrzu',()=>{const p=spawn();tick(p,{},20);tick(p,{jump:true});tick(p,{},20);const velocity=p.vy;tick(p,{jump:true});assert.ok(p.vy>velocity);});
test('kolce i przepaście powodują śmierć',()=>{const p=spawn();p.x=690;p.y=370;assert.equal(step(p,1/120,{}),true);p.x=470;p.y=660;assert.equal(step(p,1/120,{}),true);});

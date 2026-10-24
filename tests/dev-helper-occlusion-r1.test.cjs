'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dev = require('../js/dev-mode.js');

const nodes = [
  { type: 'stage', stageId: 'night-town', label: '夜街' },
  { type: 'stage', stageId: 'rain-port', label: '雨港' }
];
const STYLE_ID = 'dev-stage-picker-screen';

function doc() {
  const nodesById = new Map();
  function el(tag) {
    const node = {
      tag, id: '', textContent: '', hidden: false, children: [], style: {},
      appendChild(child) { this.children.push(child); if (child.id) nodesById.set(child.id, child); return child; },
      setAttribute(name, value) { this[name] = value; },
      addEventListener() {}
    };
    return node;
  }
  const body = el('body');
  const head = el('head');
  body.dataset = {};
  const document = {
    body, head, documentElement: el('html'),
    createElement: el,
    getElementById: id => nodesById.get(id) || null
  };
  document.documentElement.appendChild(head);
  document.documentElement.appendChild(body);
  return document;
}

test('dev=false does not mount the picker or the screen style', () => {
  const document = doc();
  assert.equal(dev.mountDevPanel(document, { dev: false, nodes }), null);
  assert.equal(document.getElementById('dev-stage-picker'), null);
  assert.equal(document.getElementById(STYLE_ID), null);
  assert.equal(dev.isDevMode({ hostname: '127.0.0.1', search: '' }), false);
  assert.equal(dev.isDevMode({ hostname: '127.0.0.1', search: '?dev=1' }), true);
});

test('mounted style hides the picker only while gameScreen is other', () => {
  const document = doc();
  const host = dev.mountDevPanel(document, { dev: true, nodes });
  assert.equal(host.id, 'dev-stage-picker');
  const style = document.getElementById(STYLE_ID);
  assert.ok(style, 'DEV mount adds one style');
  const css = style.textContent;
  assert.match(css, /body\[data-game-screen="other"\] #dev-stage-picker\{display:none\}/);
  assert.equal(css.includes('data-game-screen="menu"'), false);
  assert.equal(css.includes('data-game-screen="map"'), false);
  assert.match(host.style.cssText, /pointer-events:auto/);
  dev.mountDevPanel(document, { dev: true, nodes });
  assert.equal(document.head.children.filter(node => node.id === STYLE_ID).length, 1);
});

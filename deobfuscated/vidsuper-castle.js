const { createVidsuperProvider, getSource } = require(require('path').join(__dirname, 'vidsuper-runtime-adapter.cjs'));

module.exports = createVidsuperProvider(getSource('castle'));

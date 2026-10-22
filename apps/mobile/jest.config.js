module.exports = {
  setupFiles: ['<rootDir>/testSetup.js'],
  testEnvironment: 'node',
  transform: {'^.+\\.(js|ts|tsx)$': 'babel-jest'},
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

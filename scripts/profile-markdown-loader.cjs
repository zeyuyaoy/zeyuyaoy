module.exports = function profileMarkdownLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};

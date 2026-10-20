const AIProvider = require('./AIProvider');
// Offline provider: preserve source evidence instead of manufacturing a domain catalog.
class MockAIProvider extends AIProvider {
  async analyzeProject(input={}) {
    return require('../analysis/documentExtraction').extract(input.description||'',{mode:'local',fileName:input.name});
  }
  async analyze(description,context={}) { return this.analyzeProject({description,name:context.name}); }
}
module.exports=MockAIProvider;

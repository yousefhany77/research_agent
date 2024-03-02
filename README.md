<h1 align="center" style="border-bottom: none;">research-agent</h1>

<p align="center">
  <a href="ttps://github.com/yousefhany77/research_agent/actions/workflows/test-and-release.yml">
    <img alt="Build states" src="https://github.com/yousefhany77/research_agent/actions/workflows/test-and-release.yml/badge.svg">
  </a>

  <a href="https://github.com/yousefhany77/research-agent/actions">
    <img alt="Coverage" src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/yousefhany77/d4cff36886172dd5d7388c1a9199782d/raw/0ea8a505354e198fdf0ac12b9f55476efb1bb7ad/ts-npm-template-coverage.json">
  </a>
</p>

## Description

`research-agent` leverages AI to automate the research process. It can:
Analyze websites and extract relevant information.
Generate summaries of findings.
Create detailed reports in markdown format.
The library supports multiple AI models

- [x] OpenAI
- [ ] Mistral AI

## Getting Started

### Install

```
pnpm add research-agent
```

### Usage

```ts
import { writeFileSync } from 'fs';
import { ResearchManager } from 'research-agent';

const writeToFile = async (fileName, data) => {
  writeFileSync(fileName, data);
};

const main = async () => {
  const manager = new ResearchManager(); // You can customize the LLM model here
  const result = await manager.search('Who is this person in that website "www.youssefhany.dev"?');

  // Write the report to a markdown file
  await writeToFile('output.md', result);
};

void main();
```

This code snippet creates a ResearchManager instance and uses it to search for information about a person on a specific website. The search results are then written to a markdown file.

### Features

- `Multiple AI model support`: Choose from OpenAI, Mistral AI, and potentially others.
- `Question generation`: Automatically generates questions to guide the research process.
- `Web search and analysis`: Utilizes tools like Tavily Search and Puppeteer to gather information from the web.
- `Report generation: Creates` comprehensive reports in markdown format.

# Contributing

Contributions are welcome!

# License

This project is licensed under the [MIT license](LICENSE).

# API Reference

For detailed information about the library's API, please refer to the exported classes and functions:
`ResearchManager`: Manages the research process and generates reports.
`QuestionGeneratorAgent`: Generates questions to guide research.
`SearchWorker`: Performs web searches and analyzes websites.

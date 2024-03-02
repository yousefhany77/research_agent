<h1 align="center" style="border-bottom: none;">research-agent</h1>

<p align="center">
  <a href="ttps://github.com/yousefhany77/research-agent/actions/workflows/test-and-release.yml">
    <img alt="Build states" src="https://github.com/yousefhany77/research-agent/actions/workflows/test-and-release.yml/badge.svg?branch=main">
  </a>

  <a href="https://github.com/yousefhany77/research-agent/actions">
    <img alt="Coverage" src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/yousefhany77/b70e2342a5be5259b768aace465f777a/raw/0ea8a505354e198fdf0ac12b9f55476efb1bb7ad/ts-npm-template-coverage.json">
  </a>
</p>

## Description

A research agent that uses AI to research the web and summarize and create reports

## Getting Started

## Features

✨ Supports multiple models like Open AI,Mistral AI ,

### Install

```
pnpm add research-agent
```

### Usage

```ts
import { writeFileSync } from 'fs';
import { ResearchManager } from './lib/agents/ResearchManager/ResearchManager.js';
const writeToFile = async (fileName: string, data: string) => {
  writeFileSync(fileName, data);
};

const main = async () => {
  const manager = new ResearchManager(); // you can customize the llm model 
  const result = await manager.search('Who is this person in that website "www.youssefhany.dev"?');

  // write to a markdown file
  await writeToFile('output.md', result);
};

void main();
```

# Contributing

Contributions are welcome!

# License

This project is licensed under the [MIT license](LICENSE).

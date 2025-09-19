# NEM12 Adapter

## Overview

NEM12 Adapter is a Node.js/TypeScript project that provides a REST API for converting various energy data file formats (Jemena/AusNet, Origin, Powerpal) into the standardized NEM12 format. The server automatically detects the input file type and returns the converted NEM12 text.

## Features

- Exposes a `/convert-to-nem12` endpoint for file uploads
- Detects and converts supported energy data files to NEM12 format
- Built with Express and TypeScript

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Install dependencies

```sh
npm install
```

### Build the project

```sh
npm run build
```

### Run tests

```sh
npm test
```

### Start the server

```sh
npm start
```

The server will run on port 3000 by default.

## API Usage

### Convert a file to NEM12

**Endpoint:** `POST /convert-to-nem12`  
**Content-Type:** `multipart/form-data`  
**Form field:** `datafile` (the file to convert)

#### Example using `curl`:

```sh
curl -X POST http://localhost:3000/convert-to-nem12 \
	-F "datafile=@data/your_data_file.csv" \
	--output converted_nem12.txt
```

- Replace `data/your_data_file.csv` with the path to your input file.
- The response will be the NEM12-formatted text.


## Project Structure

- `src/adapters/` — Adapter classes for each supported format
- `src/nem12/` — NEM12 conversion logic and types
- `src/index.ts` — Express server entry point
- `data/` — Example input files

## Creating a New Adapter

To add support for a new input file format, follow these steps:

1. **Create a new adapter class** in `src/adapters/`, e.g., `NewFormatAdapter.ts`.
2. **Extend `BaseAdapter`** and implement the required methods:
	- `isValid(fileContent: Buffer): boolean` — Detects if the adapter can process the input file.
	- `getIntervalLength(fileContent: Buffer): number` — Returns the interval length in minutes.
	- `parseRows(fileContent: Buffer): ParsedRow[]` — Parses the input file and returns an array of `ParsedRow` objects.
3. **Register your adapter**  
	 To make your adapter available for detection and conversion, add it to the `adapters` array in `src/nem12/convert.ts`. For example:

	 ```typescript
	 import { NewFormatAdapter } from '../adapters/NewFormatAdapter';
	 // ...existing imports

	 const adapters: Adapter[] = [
		 // ...existing adapters
		 new NewFormatAdapter(), // <-- Add your adapter here
	 ];
	 ```

	 The system will automatically use your adapter if its `isValid` method returns `true` for an uploaded file.
5. **Add a test file** in `src/adapters/__tests__/` to validate your adapter's behavior.

Refer to existing adapters (e.g., `JemenaAdapter.ts`, `OriginAdapter.ts`, `PowerpalAdapter.ts`) for implementation examples.

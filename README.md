# TypeGPU Resolve Benchmarks

## Overview
This document explains how to run and maintain the TypeGPU resolve benchmarks. These benchmarks are executed in a GitHub Actions virtual machine and help track performance across releases.

## Usage Instructions

1. **Manual Workflow Trigger**
   The benchmark workflow should be triggered manually to ensure that the latest tag is present.

> [!NOTE]
> The script iterates through all releases and currently takes ~1 hour to complete (as of typegpu@v0.8.0).

2. **Repository Permissions**
   The GitHub Actions runner must have permission to push updates to this repository to store new benchmark results.

3. **Benchmark Storage**
   Benchmark data is stored in the `benchmarks` directory.
   - Each file corresponds to a single release.
   - Each file contains a JSON object with the following structure:

   ```ts
   {
     resolutionMetrics: [
       {
         resolveDuration: number,
         compileDuration: number,
         wgslSize: number,
       }
     ]
   }
   ```

4. **Installing Dependencies**
   We use `pnpm` as the package manager, so install dependencies with:
   ```bash
   pnpm install
   ```
   Also, make sure that you have `deno` and `python` installed.

5. **Running Benchmarks Locally**
   To run the benchmarks locally:
   ```bash
   pnpm run measure
   ```

6. **Plotting Results**
   To generate benchmark plots:
   - Create a Python 3 virtual environment
   - Run:
     ```bash
     pnpm run local:env && pnpm run plot
     ```

7. **Fetching Plots**
   Generated plot PNG files are stored in the `plots` directory and can be fetched for displaying on the main website.

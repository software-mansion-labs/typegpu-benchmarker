import json
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

# === CONFIGURATION ===
data_folder = Path("./benchmarks")
output_prefix = "./plots/combined-"

# === READ ALL JSON FILES ===
all_data = []

for json_file in data_folder.glob("*.json"):
    with open(json_file, "r") as f:
        data = json.load(f)
        metrics = data.get("resolutionMetrics", [])
        for entry in metrics:
            entry["version"] = json_file.stem
            all_data.append(entry)

df = pd.DataFrame(all_data)

# (Optional) drop rows with resolveDuration = 0
df = df[df["resolveDuration"] != 0]

# === PLOTTING ===
plt.figure(figsize=(8, 6))

versions = sorted(df["version"].unique())
colors = plt.colormaps["viridis"](np.linspace(0, 1, len(versions)))

for y in ["resolveDuration"]:
    for color, version in zip(colors, versions):
        group = df[df["version"] == version]
        plt.scatter(
            group["wgslSize"],
            group[y],
            alpha=0.6,
            s=30,
            color=color,
            label=version,
        )

        a, b = np.polyfit(group["wgslSize"], group[y], 1)
        x_line = np.linspace(df["wgslSize"].min(), df["wgslSize"].max(), 100)
        y_line = a * x_line + b
        plt.plot(x_line, y_line, color=color, linewidth=2, linestyle="--")

    # === LABELS & STYLE ===
    plt.title(f"{y} vs wgslSize in TypeGPU releases")
    plt.xlabel("wgslSize")
    plt.ylabel(f"{y} (ms)")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()

    # === SAVE TO FILE ===
    plt.savefig(f"{output_prefix}{y}.png", dpi=300)
    plt.close()

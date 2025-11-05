import json
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

# === CONFIGURATION ===
data_folder = Path("./benchmarks")
output_prefix = "./plots/combined-"
logscale = True

# === READ ALL JSON FILES ===
all_data = []

for json_file in data_folder.glob("*.json"):
    with open(json_file, "r") as f:
        data = json.load(f)
        metrics = data.get("resolutionMetrics", [])
        for entry in metrics:
            entry["release"] = json_file.stem
            all_data.append(entry)

df = pd.DataFrame(all_data)

# (Optional) drop rows with resolveDuration = 0
df = df[df["resolveDuration"] != 0]


# === PLOTTING ===
def plot_bench(
    df, metric="resolveDuration", scale="linear", max_size=None, latest=None, suffix=""
):
    data = df.copy()

    if max_size is not None:
        data = data[data["wgslSize"] <= max_size]

    if latest is not None:
        releases = sorted(data["release"].unique())[-latest:]
        data = data[data["release"].isin(releases)]

    releases = sorted(data["release"].unique())
    colors = plt.colormaps["viridis"](np.linspace(0, 1, len(releases)))

    plt.figure(figsize=(8, 6))

    if scale == "log":
        plt.xscale("log")

    for color, version in zip(colors, releases):
        group = data[data["release"] == version]

        # Scatter (raw values)
        plt.scatter(
            group["wgslSize"],
            group[metric],
            alpha=0.6,
            s=30,
            color=color,
            label=version,
        )

        a, b = np.polyfit(group["wgslSize"], group[metric], 1)
        x_line = np.linspace(data["wgslSize"].min(), data["wgslSize"].max(), 200)
        y_line = a * x_line + b

        plt.plot(x_line, y_line, color=color, linestyle="--", linewidth=2)

    title = f"{metric} vs wgslSize"
    if scale == "log":
        title += " (log scale)"
    if max_size:
        title += f" ≤ {max_size}"
    if latest:
        title += f" — last {latest} releases"

    plt.title(title)
    plt.xlabel("wgslSize" + (" (log scale)" if scale == "log" else ""))
    plt.ylabel(f"{metric} (ms)")
    plt.grid(True, which="both" if scale == "log" else "major")
    plt.legend()
    plt.tight_layout()

    fname = f"{output_prefix}{metric}{suffix}.png"
    plt.savefig(fname, dpi=300)
    plt.close()


# 1. Full dataset — linear
plot_bench(df, scale="linear", suffix="-full")

# 2. Full dataset — log scale
plot_bench(df, scale="log", suffix="-full-log")

# 3. wgslSize ≤ 10000 — linear
plot_bench(df, scale="linear", max_size=10000, suffix="-under10k")

# 4. Only 5 latest releases — linear
plot_bench(df, scale="linear", latest=5, suffix="-latest5")

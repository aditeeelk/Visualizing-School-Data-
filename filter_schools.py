import json

# open the large geojson
with open("assets/Public_School_Characteristics_2022-23.geojson") as f:
    data = json.load(f)

# keep only Washington schools
wa_features = [
    feature for feature in data["features"]
    if feature["properties"]["STABR"] == "WA"
]

# replace features with filtered ones
data["features"] = wa_features

# save new smaller file
with open("assets/wa_schools.geojson", "w") as f:
    json.dump(data, f)

print("Filtered dataset saved as wa_schools.geojson")
print("Number of schools:", len(wa_features))
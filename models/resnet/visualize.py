import json
import os
from PIL import Image, ImageDraw
import matplotlib.pyplot as plt

# Define directories
data_directory = './data'
output_directory = './vis'

# Create the output directory if it does not exist
if not os.path.exists(output_directory):
    os.makedirs(output_directory)

# Iterate through each file in the data directory
for filename in os.listdir(data_directory):
    if filename.endswith('.json'):
        # Construct file paths
        json_path = os.path.join(data_directory, filename)
        image_name = filename.replace('.json', '.png')
        image_path = os.path.join(data_directory, image_name)
        output_image_path = os.path.join(output_directory, image_name)

        # Load JSON data
        with open(json_path, 'r') as file:
            clicks = json.load(file)

        # Load the image
        image = Image.open(image_path)
        draw = ImageDraw.Draw(image)

        # Draw bounding boxes
        for click in clicks:
            rectangle = [click['x'], click['y'], click['x'] + click['width'], click['y'] + click['height']]
            draw.rectangle(rectangle, outline='red', width=2)

        # Save the newly drawn image to the output directory
        image.save(output_image_path)

        # # Optionally display the image using matplotlib
        # plt.imshow(image)
        # plt.axis('off')  # Turn off axis numbers and ticks
        # plt.show()

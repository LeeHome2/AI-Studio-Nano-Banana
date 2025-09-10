/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Part } from '@google/genai';

// --- DOM Element References ---
const uploadArea = document.getElementById('upload-area') as HTMLDivElement;
const uploadPrompt = document.getElementById('upload-prompt') as HTMLDivElement;
const imageUploadInput = document.getElementById(
  'image-upload',
) as HTMLInputElement;
const previewImage = document.getElementById('preview-image') as HTMLImageElement;
const removeImageBtn = document.getElementById(
  'remove-image-btn',
) as HTMLButtonElement;
const referenceGallery = document.getElementById(
  'reference-gallery',
) as HTMLDivElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const resultArea = document.getElementById('result-area') as HTMLDivElement;
const resultPlaceholder = document.getElementById(
  'result-placeholder',
) as HTMLDivElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLDivElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;

// --- State Management ---
let uploadedImage: {
  base64: string;
  mimeType: string;
} | null = null;
let selectedReferenceImage: string | null = null;
let ai: GoogleGenAI;

// --- Sample Reference Images ---
const referenceImages = [
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-clay.png',
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-gold.png',
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-mosaic.png',
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-origami.png',
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-pixel.png',
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-terracotta.png',
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-topiary.png',
  'https://storage.googleapis.com/maker-suite-media/user-prompt-images/style-transfer-wool.png',
];

// --- Helper Functions ---
/**
 * Converts a File object to a Base64 encoded string.
 */
function fileToGenerativePart(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts an image URL to a Base64 encoded string.
 */
async function urlToGenerativePart(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      resolve({ base64, mimeType: blob.type });
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Updates the UI state (e.g., enabling/disabling the generate button).
 */
function updateUIState() {
  generateBtn.disabled = !uploadedImage;
}

/**
 * Sets the UI to a loading state.
 */
function setLoading(isLoading: boolean) {
  if (isLoading) {
    loader.style.display = 'block';
    resultPlaceholder.style.display = 'none';
    resultImage.style.display = 'none';
    errorMessage.style.display = 'none';
    downloadBtn.style.display = 'none';
    generateBtn.disabled = true;
  } else {
    loader.style.display = 'none';
    generateBtn.disabled = false;
    updateUIState();
  }
}

/**
 * Displays an error message in the result area.
 */
function displayError(message: string) {
  setLoading(false);
  errorMessage.textContent = `Error: ${message}`;
  errorMessage.style.display = 'block';
}

// --- Event Handlers ---

/**
 * Handles image file selection and preview.
 */
async function handleImageUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }
  uploadedImage = await fileToGenerativePart(file);
  previewImage.src = `data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`;
  previewImage.style.display = 'block';
  uploadPrompt.style.display = 'none';
  removeImageBtn.style.display = 'flex';
  updateUIState();
}

/**
 * Handles the click event on the remove image button.
 */
function handleRemoveImage() {
  uploadedImage = null;
  imageUploadInput.value = ''; // Reset file input
  previewImage.src = '';
  previewImage.style.display = 'none';
  uploadPrompt.style.display = 'flex';
  removeImageBtn.style.display = 'none';
  updateUIState();
}

/**
 * Handles the selection of a reference image from the gallery.
 */
function handleReferenceImageSelect(e: Event) {
  const target = e.target as HTMLImageElement;
  if (!target || target.tagName !== 'IMG') return;

  // Deselect previous
  const previouslySelected = document.querySelector('.reference-img.selected');
  if (previouslySelected) {
    previouslySelected.classList.remove('selected');
  }

  // Select new
  if (selectedReferenceImage === target.src) {
    // If clicking the same image, deselect it
    selectedReferenceImage = null;
  } else {
    target.classList.add('selected');
    selectedReferenceImage = target.src;
  }
}

/**
 * Handles the main "Generate" button click.
 */
async function handleGenerateClick() {
  if (!uploadedImage) {
    alert('Please upload an image first.');
    return;
  }
  if (!selectedReferenceImage && !promptInput.value.trim()) {
    alert('Please either select a style image or write a prompt.');
    return;
  }

  setLoading(true);

  try {
    const contents: Part[] = [
      {
        inlineData: {
          data: uploadedImage.base64,
          mimeType: uploadedImage.mimeType,
        },
      },
    ];

    let promptText = promptInput.value.trim();

    if (selectedReferenceImage) {
      const refImagePart = await urlToGenerativePart(selectedReferenceImage);
      contents.push({
        inlineData: {
          data: refImagePart.base64,
          mimeType: refImagePart.mimeType,
        },
      });
      // Add a default prompt if none is provided but a reference image is.
      if (!promptText) {
          promptText = "Apply the style of the second image to the first image.";
      }
    }
    
    contents.push({ text: promptText });


    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: contents },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Find the image part in the response
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData,
    )?.inlineData;

    if (imagePart) {
      const base64Image = imagePart.data;
      const mimeType = imagePart.mimeType;
      const imageUrl = `data:${mimeType};base64,${base64Image}`;
      resultImage.src = imageUrl;
      resultImage.style.display = 'block';
      downloadBtn.style.display = 'flex';
    } else {
      displayError('No image was generated. Please try a different prompt.');
    }
  } catch (error) {
    console.error(error);
    displayError(
      error instanceof Error ? error.message : 'An unknown error occurred.',
    );
  } finally {
    setLoading(false);
  }
}

// --- Initialization ---

/**
 * Populates the reference image gallery.
 */
function initializeGallery() {
  referenceImages.forEach((src) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Reference Style';
    img.className = 'reference-img';
    referenceGallery.appendChild(img);
  });
}

/**
 * Sets up all event listeners for the application.
 */
function initializeEventListeners() {
  uploadArea.addEventListener('click', () => imageUploadInput.click());
  imageUploadInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  });

  // Drag and Drop listeners
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  });

  removeImageBtn.addEventListener('click', handleRemoveImage);
  referenceGallery.addEventListener('click', handleReferenceImageSelect);
  generateBtn.addEventListener('click', handleGenerateClick);
  downloadBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = resultImage.src;
      a.download = 'fused-image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  });
}

/**
 * Main application entry point.
 */
async function main() {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  } catch (error) {
    console.error('Failed to initialize GoogleGenAI:', error);
    displayError(
      'Could not initialize the AI service. Please check your API key setup.',
    );
    // Disable the whole app if AI can't be initialized
    generateBtn.disabled = true;
    promptInput.disabled = true;
    return;
  }
  
  initializeGallery();
  initializeEventListeners();
  updateUIState();
}

main();

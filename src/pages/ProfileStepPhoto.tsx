import { ChangeEvent, DragEvent, FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiUploadPhoto } from "../api";

export default function ProfileStepPhoto() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const f = files[0];

    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (f.size > 8 * 1024 * 1024) {
      setError("Max file size is 8MB");
      return;
    }

    setFile(f);
    setError(null);

    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreview(result);
      try {
        localStorage.setItem("profileAvatar", result);
      } catch {
        
      }
    };
    reader.readAsDataURL(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!file || !preview) {
      setError("Add at least one selfie");
      return;
    }

    try {
      await apiUploadPhoto(preview);
      navigate("/profile-step-5");
    } catch (err) {
      console.error(err);
      setError("Failed to upload photo");
    }
  };

  return (
    <Layout>
      <div className="onb-page">
        <div className="onb-center slide-up">
          <h1 className="onb-title">Upload your photo</h1>
          <p className="onb-subtitle">
            Only the age will appear in the profile. You should be clearly
            visible in the photo.
          </p>

          <form onSubmit={handleSubmit} className="onb-form onb-form--full">
            <div
              className="onb-upload-zone"
              onDrop={onDrop}
              onDragOver={onDragOver}
            >
              <div className="onb-upload-icon">📄⬆</div>
              <p className="onb-upload-title">
                Drag and drop a file here or click to upload.
              </p>

              <input
                type="file"
                accept="image/*"
                className="onb-upload-input"
                onChange={onChange}
              />

              {preview && (
                <div className="onb-upload-preview">
                  <img src={preview} alt="Preview" />
                </div>
              )}
            </div>

            {error && <div className="onb-error">{error}</div>}

            <button
              type="submit"
              className="button button--primary onb-button onb-button--wide"
            >
              Add selfie
            </button>
          </form>
        </div>

        <div className="onb-emoji-row">
          <span className="onb-emoji-side">👀</span>
          <div className="onb-emoji-main">📸</div>
          <span className="onb-emoji-side">🎯</span>
        </div>
        
      </div>
    </Layout>
  );
}

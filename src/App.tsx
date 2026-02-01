import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileStepName from "./pages/ProfileStepName";
import ProfileStepBirth from "./pages/ProfileStepBirth";
import ProfileStepDating from "./pages/ProfileStepDating";
import ProfileStepPhoto from "./pages/ProfileStepPhoto";
import ProfileStepPurpose from "./pages/ProfileStepPurpose";
import ProfilePage from "./pages/ProfilePage";
import RecommendationsPage from "./pages/Recommendations";
import Friends from "./pages/Friends";
import Messages from "./pages/Messages";


function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/profile-step-1" element={<ProfileStepName />} />
      <Route path="/profile-step-2" element={<ProfileStepBirth />} />
      <Route path="/profile-step-3" element={<ProfileStepDating />} />
      <Route path="/profile-step-4" element={<ProfileStepPhoto />} />
      <Route path="/profile-step-5" element={<ProfileStepPurpose />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/recommendations" element={<RecommendationsPage />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/messages" element={<Messages />} />
<Route path="/messages/:chatId" element={<Messages />} />
      
    </Routes>
  );
}

export default App;

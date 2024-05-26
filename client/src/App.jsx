import { Route, Routes } from "react-router-dom";
import Contact from "./components/Contact";
import Home from "./components/Home";
import Signin from "./components/Signin";
import Signup from "./components/Signup";
import Popup from "./components/Popup";
// import Login from "./components/Login";

function App() {
  return (
    <Routes>
      <Route path="/" Component={Home} />
      <Route path="/signup" Component={Signup} />
      <Route path="/signin" Component={Signin} />
      <Route path="/popup" Component={Popup} />
      <Route path="/contact" Component={Contact} />
    </Routes>
  );
}
export default App;

import { useEffect, useState } from "react";
import "../styles/Blogpage.css";
import { useNavigate } from "react-router-dom";

function Myblogs({ publicprofileusername, backgroundcolor }) {
  const navigate = useNavigate();
  const [blogarray, setBlogarray] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTitles, setExpandedTitles] = useState({});

  useEffect(() => {
    const fetchUserBlogs = async () => {
      try {
        const username =
          publicprofileusername || localStorage.getItem("Username");
        if (!username) {
          throw new Error("Username not found in localStorage");
        }

        const res = await fetch("https://codru-server.vercel.app/userblogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const jsondata = await res.json();
        if (!Array.isArray(jsondata.blogs)) {
          throw new Error("Invalid data format received from server");
        }

        setBlogarray(jsondata.blogs);
        console.log(jsondata.blogs);
      } catch (error) {
        console.error("There was a problem with the fetch operation:", error);
        // Handle error state if needed
      } finally {
        setLoading(false); // Ensure loading is set to false whether request succeeds or fails
      }
    };

    fetchUserBlogs();
  }, [publicprofileusername]);

  if (loading) {
    return <div>Loading...</div>; // Display a loading message while fetching data
  }

  const handleBlogClick = (blogId) => {
    console.log(`Navigating to blog with ID: ${blogId}`);
    navigate(`/blog/${blogId}`);
  };

  const extractFirstImageAndSnippet = (content) => {
    const doc = new DOMParser().parseFromString(content, "text/html");
    const img = doc.querySelector("img");
    const text = doc.body.textContent || "";
    return {
      image: img ? img.src : null,
      snippet: text.slice(0, 200) + "...",
    };
  };

  const toggleTitleExpansion = (index) => {
    setExpandedTitles((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const userPhoto = localStorage.getItem("Photo");

  return (
    <div
      className="blog-page"
      style={{ backgroundColor: backgroundcolor ? "white" : "" }}
    >
      {blogarray.length > 0 ? (
        blogarray.map((data, index) => {
          const contentPreview = extractFirstImageAndSnippet(data.content);
          const isExpanded = expandedTitles[index];
          const title = data.title;
          const snippet = contentPreview.snippet;

          return (
            <div
              key={index}
              className="blog-post"
              style={{ backgroundColor: backgroundcolor ? "white" : "" }}
            >
              {contentPreview.image ? (
                <img src={contentPreview.image} alt="Blog Image" />
              ) : (
                <img src={userPhoto} alt="User Photo" />
              )}
              <h2 className="blogtitle">
                {title &&
                  (isExpanded || title.length <= 70 ? (
                    title
                  ) : (
                    <>
                      {title.slice(0, 70)}...{" "}
                      <span
                        className="blog-page-show-more"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTitleExpansion(index);
                        }}
                      >
                        Read More
                      </span>
                    </>
                  ))}
              </h2>

              <span className="blogpagesnippet">{snippet}</span>
              <div className="blogseemore">
                <button onClick={() => handleBlogClick(data._id)}>
                  Read More
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div>No Posts Yet..</div>
      )}
    </div>
  );
}

export default Myblogs;

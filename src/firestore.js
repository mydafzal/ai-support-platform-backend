const {
  collection,
  getDoc,
  doc,
  query,
  getDocs,
} = require("firebase/firestore");
const { firestore } = require("./firebase");

// Function to get a user document by ID
async function getUser(by, value) {
  try {
    const snapshot = await firestore
      .collection("users")
      .where(by, "==", value)
      .get();

    if (snapshot.empty) {
      return "Firebase: User not found";
    }

    const user = snapshot.docs[0].data();

    console.log("firebase user", user);

    return user;
  } catch (error) {
    console.error("Error getting user document:", error);
    throw error;
  }
}

module.exports = { getUser };

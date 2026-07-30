const express = require("express");
const Course = require("../models/courseSchema");

const addSubject = async (req, res) => {
const { section, subjectID } = req.body;

  if (!section || !subjectID) {
    return res
      .status(400)
      .json({ error: "Section and SubjectID are required." });
  }

  try {
    const course = await Course.findOne();

    if (!course) {
      return res.status(404).json({ error: "No course found." });
    }

    if (
      !["allsubjects", "skilldevelopment", "customcourses"].includes(section)
    ) {
      return res.status(400).json({ error: "Invalid section." });
    }

    const subject = { subjectID };
    course[section].push(subject);
    await course.save();

    res.status(201).json({ message: "Subject added successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

const addPrice = async (req, res) => {
const { section, subjectID, durationValue, durationUnit, price } = req.body;

  if (!section || !subjectID || !durationValue || !durationUnit || !price) {
    return res.status(400).json({ error: "Missing fields." });
  }

  try {
    const course = await Course.findOne();
    if (!course) {
      return res.status(404).json({ error: "No course found." });
    }

    if (
      !["allsubjects", "skilldevelopment", "customcourses"].includes(section)
    ) {
      return res.status(400).json({ error: "Invalid section." });
    }

    const subjectIndex = course[section].findIndex(
      (subject) => subject.subjectID === subjectID
    );
    if (subjectIndex === -1) {
      return res
        .status(404)
        .json({ error: "Subject not found in the specified section." });
    }

    const newPrice = {
      duration: { value: durationValue, unit: durationUnit },
      price,
    };
    course[section][subjectIndex].prices.push(newPrice);
    await course.save();

    res.status(201).json({ message: "Price added successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

const deleteSubject = async (req, res) => {
const { section, subjectID } = req.body;

  if (!section || !subjectID) {
    return res
      .status(400)
      .json({ error: "Section and SubjectID are required." });
  }

  try {
    const course = await Course.findOne();
    if (!course) {
      return res.status(404).json({ error: "No course found." });
    }

    if (
      !["allsubjects", "skilldevelopment", "customcourses"].includes(section)
    ) {
      return res.status(400).json({ error: "Invalid section." });
    }

    const subjectIndex = course[section].findIndex(
      (subject) => subject.subjectID === subjectID
    );
    if (subjectIndex === -1) {
      return res
        .status(404)
        .json({ error: "Subject not found in the specified section." });
    }

    course[section].splice(subjectIndex, 1);
    await course.save();

    res.status(200).json({ message: "Subject deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }

}

const deletePrice = async (req, res) => {
  const { section, subjectID, durationValue, durationUnit } = req.body;

  if (!section || !subjectID || !durationValue || !durationUnit) {
    return res.status(400).json({ error: "Missing fields." });
  }

  try {
    const course = await Course.findOne();
    if (!course) {
      return res.status(404).json({ error: "No course found." });
    }

    if (
      !["allsubjects", "skilldevelopment", "customcourses"].includes(section)
    ) {
      return res.status(400).json({ error: "Invalid section." });
    }

    const subjectIndex = course[section].findIndex(
      (subject) => subject.subjectID === subjectID
    );
    if (subjectIndex === -1) {
      return res
        .status(404)
        .json({ error: "Subject not found in the specified section." });
    }

    const priceIndex = course[section][subjectIndex].prices.findIndex(
      (price) =>
        price.duration.value === durationValue &&
        price.duration.unit === durationUnit
    );
    if (priceIndex === -1) {
      return res
        .status(404)
        .json({ error: "Price not found for the specified duration." });
    }

    course[section][subjectIndex].prices.splice(priceIndex, 1);
    await course.save();

    res.status(200).json({ message: "Price deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}


module.exports = {
  addSubject,
  addPrice,
    deleteSubject,
    deletePrice
};
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const chatModel = require("../models/chatModel");
const Group = require("../models/groupModel");
const Member = require("../models/memberModel");
const GroupChat = require("../models/groupChatModel");
const mongoose = require("mongoose");

const registerLoad = (req, res) => {
  res.render("register", { message: "" });
};

const register = async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.password, 10);

    const user = new User({
      name: req.body.name,
      email: req.body.email,
      image: "images/" + req.file.filename,
      password: passwordHash,
    });

    await user.save();

    return res.render("register", { message: "Your registration Succesfully" });
  } catch (error) {
    console.log(error.message);
  }
};

const loadLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error.message);
  }
};

const login = async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const userData = await User.findOne({ email: email });
    if (userData) {
      const passwordMatch = await bcrypt.compare(password, userData.password);

      if (passwordMatch) {
        req.session.user = userData;
        res.cookie(`user`, JSON.stringify(userData));
        res.redirect("/dashboard");
      } else {
        res.render("login", { message: "Email and Password is incorrect!!" });
      }
    } else {
      res.render("login", { message: "Email and Password is incorrect!!" });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("user");
    req.session.destroy();
    res.redirect("/");
  } catch (error) {
    console.log(error.message);
  }
};

const loadDashboard = async (req, res) => {
  try {
    let users = await User.find({ _id: { $nin: [req.session.user._id] } });
    res.render("dashboard", { user: req.session.user, users: users });
  } catch (error) {
    console.log(error.message);
  }
};

const saveChat = async (req, res) => {
  try {
    var chat = new chatModel({
      sender_id: req.body.sender_id,
      receiver_id: req.body.receiver_id,
      message: req.body.message,
    });

    var newChat = await chat.save();
    res
      .status(200)
      .send({ success: true, msg: "Chat Inserted", data: newChat });
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
};

const deleteChat = async (req, res) => {
  try {
    await chatModel.deleteOne({ _id: req.body.id });
    res.status(200).send({ success: true });
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
};

const updateChat = async (req, res) => {
  try {
    await chatModel.findByIdAndUpdate(req.body.id, {
      $set: {
        message: req.body.message,
      },
    });
    res.status(200).send({ success: true });
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
};

const loadGroups = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/");
    }
    const groups = await Group.find({ creator_id: req.session.user._id });

    res.render("group", { groups: groups });
  } catch (error) {
    console.log(error.message);
  }
};

const createGroup = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/");
    }

    const group = new Group({
      creator_id: req.session.user._id,
      name: req.body.name,
      image: "images/" + req.file.filename, // Changed from "image/" to "images/"
      limit: req.body.limit,
    });
    await group.save();
    const groups = await Group.find({ creator_id: req.session.user._id });

    res.render("group", {
      message: req.body.name + " Group Created Successfully",
      groups: groups,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const getMembers = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { group_id } = req.body;
    if (!group_id) {
      return res
        .status(400)
        .json({ success: false, message: "group_id is required" });
    }

    console.log("Group ID received:", group_id);

    const groupMembers = await Member.find({ group_id }).select("user_id -_id");

    const allUsers = await User.find({
      _id: { $ne: req.session.user._id },
    }).select("name _id");

    const usersWithMembership = allUsers.map((user) => ({
      ...user.toObject(),
      member: groupMembers.some(
        (m) => m.user_id?.toString() === user._id.toString()
      )
        ? [{ _id: user._id }]
        : [],
    }));

    return res.status(200).json({ success: true, data: usersWithMembership });
  } catch (error) {
    console.error("Error in /get-members:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error fetching members" });
  }
};

const addMembers = async (req, res) => {
  try {
    if (!req.body.members) {
      res
        .status(200)
        .send({ success: false, msg: "Please select any one Memeber" });
    } else if (req.body.members.length > parseInt(req.body.limit)) {
      res.status(200).send({
        success: false,
        msg: "You can not select more than" + req.body.limit + " Members",
      });
    } else {
      await Member.deleteMany({ group_id: req.body.group_id.trim() });
      var data = [];
      const members = req.body.members;

      for (let i = 0; i < members.length; i++) {
        data.push({
          group_id: req.body.group_id.trim(),
          user_id: members[i],
        });
      }

      await Member.insertMany(data);

      res
        .status(200)
        .send({ success: true, msg: "Members added Successfully" });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const updateChatGroup = async (req, res) => {
  try {
    if (parseInt(req.body.limit) < parseInt(req.body.last_limit)) {
      await Member.deleteMany({ group_id: req.body.id });
    }

    let updateObj = {
      name: req.body.name,
      limit: req.body.limit,
    };

    if (req.file !== undefined) {
      updateObj.image = "images/" + req.file.filename;
    }

    await Group.findByIdAndUpdate(
      req.body.id,
      { $set: updateObj },
      { new: true }
    );

    res
      .status(200)
      .send({ success: true, msg: "Chat Group Updated Successfully" });
  } catch (error) {
    res.status(400).send({ success: false, message: error.message });
  }
};

const deleteChatGroup = async (req, res) => {
  try {
    const groupId = req.body.id;
    await Group.deleteOne({ _id: groupId });
    await Member.deleteMany({ group_id: groupId });
    res
      .status(200)
      .send({ success: true, msg: "Chat Group Deleted Successfully" });
  } catch (error) {
    res.status(400).send({ success: false, message: error.message });
  }
};

const shareGroup = async (req, res) => {
  try {
    const groupData = await Group.findOne({ _id: req.params.id });

    if (!groupData) {
      return res.render("error", { message: "404 not found!" });
    }

    if (!req.session.user) {
      return res.render("error", {
        message: "You need to login to access the Share URL!",
      });
    }

    const totalMembers = await Member.countDocuments({
      group_id: req.params.id,
    });
    const available = groupData.limit - totalMembers;

    const isOwner =
      String(groupData.creator_id) === String(req.session.user._id);
    const isJoined = await Member.countDocuments({
      group_id: req.params.id,
      user_id: req.session.user._id,
    });

    res.render("shareLink", {
      group: groupData,
      totalMembers: totalMembers,
      isOwner: isOwner,
      isJoined: isJoined,
      available,
    });
  } catch (error) {
    res.status(400).send({ success: false, message: error.message });
  }
};

const joinGroup = async (req, res) => {
  try {
    const member = new Member({
      group_id: req.body.group_id,
      user_id: req.session.user._id,
    });
    await member.save();
    res.send({
      success: true,
      msg: "Congratulation, you have Joined the Group Successfully!",
    });
  } catch (error) {
    res.send({ success: false, msg: error.message });
  }
};

const groupChats = async (req, res) => {
  try {
    const myGroups = await Group.find({ creator_id: req.session.user._id });
    const joinedGroups = await Member.find({
      user_id: req.session.user._id,
    }).populate("group_id");

    res.render("chat-group", {
      myGroups: myGroups,
      joinedGroups: joinedGroups,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const saveGroupChat = async (req, res) => {
  try {
    var chat = new GroupChat({
      sender_id: req.body.sender_id,
      group_id: req.body.group_id,
      message: req.body.message,
    });

    var newChat = await chat.save();

    res.send({ success: true, chat: newChat });
  } catch (error) {
    res.send({ success: false, msg: error.message });
  }
};

const loadGroupChats = async (req, res) => {
  try {
    const groupChats = await GroupChat.find({ group_id: req.body.group_id });

    res.send({ success: true, chats: groupChats });
  } catch (error) {
    res.send({ success: false, msg: error.message });
  }
};

const deleteGroupChats = async (req, res) => {
  try {
    await GroupChat.deleteOne({ _id: req.body.id });

    res.send({ success: true, msg: "Caht Deleted" });
  } catch (error) {
    res.send({ success: false, msg: error.message });
  }
};

const updateGroupChats = async (req, res) => {
  try {
    await GroupChat.findByIdAndUpdate({ _id: req.body.id },{$set:{message:req.body.message}});

    res.send({ success: true, msg: "Caht Updated" });
  } catch (error) {
    res.send({ success: false, msg: error.message });
  }
};
module.exports = {
  deleteGroupChats,
  register,
  registerLoad,
  login,
  loadLogin,
  loadDashboard,
  logout,
  saveChat,
  deleteChat,
  updateChat,
  loadGroups,
  createGroup,
  getMembers,
  addMembers,
  updateChatGroup,
  deleteChatGroup,
  shareGroup,
  joinGroup,
  groupChats,
  saveGroupChat,
  loadGroupChats,
  updateGroupChats
};

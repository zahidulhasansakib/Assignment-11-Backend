const express = require("express");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcryptjs");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRATE);
const crypto = require("crypto");
const app = express();
const port = process.env.PORT || 5000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8",
);
const serviceAccount = JSON.parse(decoded);

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorize access" });
  }
  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded info", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorize access" });
  }
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ================= MONGODB =================
const uri =
  "mongodb+srv://misssonscic11:sGlNB5GI6KRwpAZ4@cluster0.entyjty.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Global collections
let userCollections,
  donationCollections,
  paymentsCollections,
  tuitionCollections,
  applicationCollections;

async function run() {
  try {
    await client.connect();
    const database = client.db("missionscic11DB");

    userCollections = database.collection("user");
    donationCollections = database.collection("donationRequests");
    paymentsCollections = database.collection("payments");
    tuitionCollections = database.collection("tuitions");
    applicationCollections = database.collection("applications"); // নতুন collection

    console.log("✅ MongoDB connected successfully!");

    // ================= USER API =================
    app.post("/user", async (req, res) => {
      try {
        const {
          name,
          email,
          password,
          blood,
          district,
          upazila,
          photoURL,
          uid,
        } = req.body;

        if (!email || !password || !blood || !district || !upazila) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        const existingUser = await userCollections.findOne({ email });
        if (existingUser) {
          return res.status(409).send({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userInfo = {
          name,
          email,
          password: hashedPassword,
          blood,
          districtName: district,
          upazilaName: upazila,
          photoURL,
          uid,
          status: "active",
          role: "donor",
          createdAt: new Date(),
        };

        const result = await userCollections.insertOne(userInfo);
        res.send(result);
      } catch (error) {
        console.error("❌ User create error:", error);
        res.status(500).send({ message: "Failed to create user" });
      }
    });

    app.get("/users", async (req, res) => {
      try {
        const result = await userCollections.find().toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });
    // backend/server.js - এই অংশগুলো যোগ করুন

    const { generateToken } = require("./utils/jwtUtils");
    const {
      authenticateToken,
      authorizeRoles,
    } = require("./middleware/authMiddleware");

    // backend/server.js - আপনার login route (run() function এর ভিতরে)

   app.post("/login", async (req, res) => {
     try {
       const { email, password } = req.body;
       console.log("========== LOGIN DEBUG ==========");
       console.log("1. Email received:", email);
       console.log(
         "2. Password received:",
         password ? "✓ Provided" : "✗ Missing",
       );
       console.log("3. Password length:", password?.length);

       // ইউজার খুঁজুন
       console.log("4. Searching user in database...");
       const user = await userCollections.findOne({ email });

       console.log("5. User found:", user ? "✓ Yes" : "✗ No");

       if (!user) {
         console.log("6. ❌ User not found");
         return res.status(401).json({
           success: false,
           message: "Email বা password ঠিক নেই",
         });
       }

       console.log("7. User email:", user.email);
       console.log("8. User role:", user.role);
       console.log(
         "9. Password field exists:",
         user.hasOwnProperty("password") ? "✓ Yes" : "✗ No",
       );
       console.log("10. Password value type:", typeof user.password);
       console.log("11. Password length:", user.password?.length);
       console.log(
         "12. Password preview:",
         user.password ? user.password.substring(0, 20) + "..." : "null",
       );

       // পাসওয়ার্ড চেক করার আগে ভ্যালিডেশন
       if (!user.password) {
         console.log("13. ❌ Password field is empty!");
         return res.status(500).json({
           success: false,
           message: "User password not found in database",
         });
       }

       if (!password) {
         console.log("14. ❌ Password not provided in request");
         return res.status(400).json({
           success: false,
           message: "Password is required",
         });
       }

       // bcrypt compare
       console.log("15. 🔐 Calling bcrypt.compare...");
       console.log("    - Input password length:", password.length);
       console.log("    - Stored hash length:", user.password.length);

       const isPasswordValid = await bcrypt.compare(password, user.password);

       console.log("16. ✅ bcrypt.compare result:", isPasswordValid);

       if (!isPasswordValid) {
         console.log("17. ❌ Password invalid");
         return res.status(401).json({
           success: false,
           message: "Email বা password ঠিক নেই",
         });
       }

       // JWT Token তৈরি করুন
       console.log("18. 🔑 Generating token...");
       const token = generateToken(user);
       console.log("19. ✅ Token generated");

       const { password: pwd, ...userWithoutPassword } = user;

       console.log("20. ✅ Login successful for:", email);
       console.log("================================");

       res.json({
         success: true,
         message: "Login successful",
         token,
         user: userWithoutPassword,
       });
     } catch (error) {
       console.error("❌ ERROR CAUGHT:", error);
       console.error("❌ Error name:", error.name);
       console.error("❌ Error message:", error.message);
       console.error("❌ Error stack:", error.stack);

       res.status(500).json({
         success: false,
         message: "Login failed",
         error: error.message,
       });
     }
   });

    // GET User by Email
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;

        if (!email) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        const user = await userCollections.findOne(
          { email },
          { projection: { password: 0 } },
        );

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.json({
          success: true,
          data: user,
        });
      } catch (error) {
        console.error("❌ Get user profile error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch user profile",
        });
      }
    });

    // PUT Update User Profile
    app.put("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const updateData = req.body;

        if (!email) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        delete updateData.email;
        delete updateData._id;
        delete updateData.password;

        updateData.updatedAt = new Date();

        const result = await userCollections.updateOne(
          { email },
          { $set: updateData },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        res.json({
          success: true,
          message: "Profile updated successfully",
        });
      } catch (error) {
        console.error("❌ Update profile error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to update profile",
        });
      }
    });

    app.get("/users/role/:email", async (req, res) => {
      try {
        const email = req.params.email;

        if (!email) {
          return res.status(400).send({
            role: "donor",
            status: "active",
            exists: false,
            message: "Email is required",
          });
        }

        const user = await userCollections.findOne({ email });

        if (!user) {
          return res.send({
            role: "donor",
            status: "active",
            exists: false,
          });
        }

        res.send({
          role: user.role || "donor",
          status: user.status || "active",
          exists: true,
        });
      } catch (error) {
        console.error("Get role error:", error);
        res.status(500).send({
          role: "donor",
          status: "active",
          exists: false,
          message: "Server error",
        });
      }
    });

    // ================= DONATION REQUEST API =================
    app.post("/donationRequests", verifyFBToken, async (req, res) => {
      try {
        const {
          requesterName,
          requesterEmail,
          recipientName,
          districtName,
          upazilaName,
          hospital,
          address,
          bloodGroup,
          donationDate,
          donationTime,
          requestMessage,
        } = req.body;

        if (
          !requesterName ||
          !requesterEmail ||
          !recipientName ||
          !districtName ||
          !upazilaName ||
          !hospital ||
          !address ||
          !bloodGroup ||
          !donationDate ||
          !donationTime ||
          !requestMessage
        ) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        const donationRequest = {
          requesterName,
          requesterEmail,
          recipientName,
          recipientDistrict: districtName,
          recipientUpazila: upazilaName,
          hospital,
          address,
          bloodGroup,
          donationDate,
          donationTime,
          requestMessage,
          status: "pending",
          donorInfo: null,
          createdAt: new Date(),
        };

        const result = await donationCollections.insertOne(donationRequest);
        res.send(result);
      } catch (error) {
        console.error("❌ Create donation request error:", error);
        res.status(500).send({ message: "Failed to create donation request" });
      }
    });

    app.get("/donationRequests", async (req, res) => {
      try {
        const requests = await donationCollections.find().toArray();
        res.send(requests);
      } catch (error) {
        console.error("❌ Get donation requests error:", error);
        res.status(500).send({ message: "Failed to get donation requests" });
      }
    });

    app.delete("/donationRequests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await donationCollections.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error("❌ Delete donation request error:", error);
        res.status(500).send({ message: "Failed to delete donation request" });
      }
    });

    app.put("/donationRequests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const result = await donationCollections.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData },
        );

        res.send(result);
      } catch (error) {
        console.error("❌ Update donation request error:", error);
        res.status(500).send({ message: "Failed to update donation request" });
      }
    });
  } finally {
    // nothing
  }
}

run().catch(console.dir);

app.get("/my-request", verifyFBToken, async (req, res) => {
  const email = req.decoded_email;
  const size = Number(req.query.size);
  const page = Number(req.query.page);
  const query = { requesterEmail: email };

  const result = await donationCollections
    .find(query)
    .limit(size)
    .skip(size * page)
    .toArray();
  const totalRequest = await donationCollections.countDocuments(query);
  res.send({ request: result, totalRequest });
});

// ================= TUITION MANAGEMENT APIs =================

// 1. GET My Tuitions (Student's tuitions)
app.get("/my-tuitions", async (req, res) => {
  try {
    const studentEmail = req.query.studentEmail;

    if (!studentEmail) {
      return res.status(400).json([]);
    }

    const tuitions = await tuitionCollections
      .find({ studentEmail: studentEmail })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(tuitions);
  } catch (error) {
    console.error("❌ Get my-tuitions error:", error);
    res.status(500).json([]);
  }
});

// 2. POST Create New Tuition
app.post("/tuitions", async (req, res) => {
  try {
    const tuitionData = req.body;

    const requiredFields = [
      "studentEmail",
      "subject",
      "class",
      "budget",
      "location",
    ];
    const missingFields = requiredFields.filter((field) => !tuitionData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const student = await userCollections.findOne({
      email: tuitionData.studentEmail,
    });

    const finalTuitionData = {
      ...tuitionData,
      studentName: student?.name || tuitionData.studentEmail.split("@")[0],
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      views: 0,
      applications: 0,
      budget: parseFloat(tuitionData.budget),
    };

    const result = await tuitionCollections.insertOne(finalTuitionData);

    res.status(201).json({
      success: true,
      message: "Tuition posted successfully!",
      data: {
        _id: result.insertedId,
        ...finalTuitionData,
      },
    });
  } catch (error) {
    console.error("❌ Create tuition error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to post tuition",
    });
  }
});

// 3. UPDATE Tuition Status (Approve/Reject) - FIXED VERSION
app.put("/tuitions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    
    console.log("📝 Updating tuition:", id);
    console.log("Update data:", updateData);
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID"
      });
    }

    // Check if tuition exists
    const tuition = await tuitionCollections.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found"
      });
    }

    console.log("Current tuition status:", tuition.status);

    // Prepare update fields
    const updateFields = {
      updatedAt: new Date()
    };

    // Add status if provided
    if (updateData.status) {
      updateFields.status = updateData.status;
      
      // Add timestamp based on status
      if (updateData.status === "approved") {
        updateFields.approvedAt = new Date();
      } else if (updateData.status === "rejected") {
        updateFields.rejectedAt = new Date();
      }
    }

    // Add other fields if provided
    if (updateData.tutorEmail) {
      updateFields.tutorEmail = updateData.tutorEmail;
      updateFields.tutorAssigned = true;
    }

    console.log("Updating with fields:", updateFields);

    // Update in database
    const result = await tuitionCollections.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    console.log("✅ MongoDB Update Result:", result);

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found"
      });
    }

    // Get updated tuition
    const updatedTuition = await tuitionCollections.findOne({
      _id: new ObjectId(id)
    });

    console.log("✅ Updated tuition:", updatedTuition);

    res.json({
      success: true,
      message: `Tuition ${updateData.status || 'updated'} successfully`,
      data: updatedTuition
    });

  } catch (error) {
    console.error("❌ Update tuition error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tuition",
      error: error.message
    });
  }
});

// 4. DELETE Tuition (Hard Delete)
app.delete("/tuitions/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID",
      });
    }

    const tuition = await tuitionCollections.findOne({ _id: new ObjectId(id) });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found",
      });
    }

    if (tuition.status === "approved" || tuition.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete approved or completed tuition",
      });
    }

    // Hard delete
    const result = await tuitionCollections.deleteOne({
      _id: new ObjectId(id),
    });

    // Delete all applications for this tuition
    await applicationCollections.deleteMany({ tuitionId: id });

    res.json({
      success: true,
      message: "Tuition deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete tuition error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete tuition",
    });
  }
});

// GET Single Tuition by ID - with better error handling
app.get("/tuitions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    
    console.log("Received request for tuition ID:", id);
    
    // Check if ID is valid
    if (!id || id === ":id" || id === "undefined") {
      return res.status(400).json({ 
        success: false,
        message: "Invalid tuition ID format" 
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid tuition ID format" 
      });
    }
    
    const tuition = await tuitionCollections.findOne({
      _id: new ObjectId(id),
    });

    if (!tuition) {
      return res.status(404).json({ 
        success: false,
        message: "Tuition not found" 
      });
    }

    // Increment views
    await tuitionCollections.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { views: 1 } },
    );

    res.json({
      success: true,
      data: tuition
    });
  } catch (error) {
    console.error("❌ Get tuition error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch tuition",
      error: error.message 
    });
  }
});

// ================= APPLICATIONS APIs =================

// GET Applied Tutors for Student's Tuitions
app.get("/applied-tutors", async (req, res) => {
  try {
    const studentEmail = req.query.studentEmail;

    if (!studentEmail) {
      return res.status(400).json({
        success: false,
        message: "Student email is required",
      });
    }

    // Get all tuitions of this student
    const tuitions = await tuitionCollections
      .find({ studentEmail })
      .project({ _id: 1, subject: 1, class: 1, budget: 1, location: 1 })
      .toArray();

    const tuitionIds = tuitions.map((t) => t._id.toString());

    if (tuitionIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
      });
    }

    // Get all applications for these tuitions
    const applications = await applicationCollections
      .find({ tuitionId: { $in: tuitionIds } })
      .sort({ appliedAt: -1 })
      .toArray();

    // Get tutor details for each application
    const applicationsWithDetails = await Promise.all(
      applications.map(async (app) => {
        const tutor = await userCollections.findOne(
          { email: app.tutorEmail },
          { projection: { name: 1, email: 1, photoURL: 1, phone: 1 } },
        );

        const tuition = tuitions.find(
          (t) => t._id.toString() === app.tuitionId,
        );

        return {
          ...app,
          tutor: tutor || { name: app.tutorEmail?.split("@")[0] },
          tuition: tuition || { subject: "Unknown", class: "N/A", budget: 0 },
        };
      }),
    );

    res.json({
      success: true,
      data: applicationsWithDetails,
      count: applications.length,
    });
  } catch (error) {
    console.error("❌ Get applied tutors error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications",
    });
  }
});

// POST Apply for Tuition (Tutor)
app.post("/apply-tuition", async (req, res) => {
  try {
    const { tuitionId, tutorEmail, message, proposedFee } = req.body;

    if (!tuitionId || !tutorEmail) {
      return res.status(400).json({
        success: false,
        message: "Tuition ID and Tutor Email are required",
      });
    }

    // Check if already applied
    const existingApplication = await applicationCollections.findOne({
      tuitionId,
      tutorEmail,
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for this tuition",
      });
    }

    // Get tuition details
    const tuition = await tuitionCollections.findOne({
      _id: new ObjectId(tuitionId),
    });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found",
      });
    }

    const applicationData = {
      tuitionId,
      tutorEmail,
      message: message || "",
      proposedFee: proposedFee || tuition.budget,
      status: "pending",
      appliedAt: new Date(),
      studentEmail: tuition.studentEmail,
    };

    const result = await applicationCollections.insertOne(applicationData);

    // Update application count in tuition
    await tuitionCollections.updateOne(
      { _id: new ObjectId(tuitionId) },
      { $inc: { applications: 1 } },
    );

    res.status(201).json({
      success: true,
      message: "Application submitted successfully!",
      data: {
        _id: result.insertedId,
        ...applicationData,
      },
    });
  } catch (error) {
    console.error("❌ Apply tuition error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit application",
    });
  }
});

// PUT Update Application Status (Approve/Reject)
app.put("/applications/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'approved' or 'rejected'",
      });
    }

    const application = await applicationCollections.findOne({
      _id: new ObjectId(id),
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Update application status
    await applicationCollections.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
    );

    // If approved, update tuition status
    if (status === "approved") {
      await tuitionCollections.updateOne(
        { _id: new ObjectId(application.tuitionId) },
        {
          $set: {
            status: "approved",
            tutorEmail: application.tutorEmail,
            approvedAt: new Date(),
          },
        },
      );

      // Reject other pending applications for this tuition
      await applicationCollections.updateMany(
        {
          tuitionId: application.tuitionId,
          _id: { $ne: new ObjectId(id) },
          status: "pending",
        },
        {
          $set: {
            status: "rejected",
            updatedAt: new Date(),
          },
        },
      );
    }

    res.json({
      success: true,
      message: `Application ${status} successfully`,
    });
  } catch (error) {
    console.error("❌ Update application error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update application",
    });
  }
});

// ================= PAYMENT APIs =================

app.post("/create-payment-checkout", async (req, res) => {
  const information = req.body;
  const amount = parseInt(information.donateAmount) * 100;

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: {
            name: "Please Donate",
          },
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    metadata: {
      donorName: information?.donorName,
    },
    customer_email: information?.donorEmail,
    success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`,
  });
  res.send({ url: session.url });
});

app.post("/success-payment", async (req, res) => {
  const { session_id } = req.query;
  const session = await stripe.checkout.sessions.retrieve(session_id);
  console.log(session);
  const transactionId = session.payment_intent;

  const isPaymentExist = await paymentsCollections.findOne({ transactionId });
  if (isPaymentExist) {
    return;
  }

  if (session.payment_status == "paid") {
    const paymentInfo = {
      amount: session.amount_total / 100,
      currency: session.currency,
      donorEmail: session.customer_email,
      transactionId,
      payment_status: session.payment_status,
      paidAt: new Date(),
    };
    const result = await paymentsCollections.insertOne(paymentInfo);
    return res.send(result);
  }
});

// GET Payment History for Student
app.get("/payments", async (req, res) => {
  try {
    const studentEmail = req.query.studentEmail;

    if (!studentEmail) {
      return res.status(400).json({
        success: false,
        message: "Student email is required",
      });
    }

    const payments = await paymentsCollections
      .find({ studentEmail })
      .sort({ paymentDate: -1 })
      .toArray();

    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    console.error("❌ Get payments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
});

// POST Create New Payment
app.post("/payments", async (req, res) => {
  try {
    const paymentData = req.body;

    const requiredFields = [
      "studentEmail",
      "tuitionId",
      "amount",
      "paymentMethod",
    ];
    const missingFields = requiredFields.filter((field) => !paymentData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const transactionId =
      "TXN" +
      Date.now() +
      Math.random().toString(36).substr(2, 9).toUpperCase();

    const payment = {
      ...paymentData,
      transactionId,
      paymentDate: new Date(),
      status: "completed",
      createdAt: new Date(),
    };

    const result = await paymentsCollections.insertOne(payment);

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully!",
      data: {
        _id: result.insertedId,
        ...payment,
      },
    });
  } catch (error) {
    console.error("❌ Create payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record payment",
    });
  }
});

// GET Single Payment by ID
app.get("/payments/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    const payment = await paymentsCollections.findOne({
      _id: new ObjectId(id),
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("❌ Get payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment",
    });
  }
});



// ================= TUITION PAYMENT + APPROVAL =================

// Create Stripe Checkout for Tuition Payment
app.post("/create-tuition-payment", async (req, res) => {
  try {
    const { studentEmail, tuitionId, tutorEmail, amount, applicationId } = req.body;

    // Get tuition details
    const tuition = await tuitionCollections.findOne({ 
      _id: new ObjectId(tuitionId) 
    });

    if (!tuition) {
      return res.status(404).json({ 
        success: false, 
        message: "Tuition not found" 
      });
    }

    // Get tutor details
    const tutor = await userCollections.findOne({ 
      email: tutorEmail 
    });

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'bdt',
            product_data: {
              name: `Tuition Payment - ${tuition.subject}`,
              description: `Payment for ${tutor?.name || tutorEmail}`,
              images: [tutor?.photoURL || 'https://via.placeholder.com/150'],
            },
            unit_amount: amount * 100, // Convert to paisa/cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}&applicationId=${applicationId}`,
      cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`,
      customer_email: studentEmail,
      metadata: {
        applicationId,
        tuitionId,
        studentEmail,
        tutorEmail,
        amount: amount.toString()
      }
    });

    res.json({ 
      success: true, 
      url: session.url 
    });

  } catch (error) {
    console.error("❌ Create tuition payment error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create payment session" 
    });
  }
});

// backend/server.js - এই route টি আপডেট করুন

// Payment Success Webhook/Endpoint
app.post('/tuition-payment-success', async (req, res) => {
  try {
    const { session_id, applicationId } = req.body;
    
    console.log("📩 Payment success webhook received:", { session_id, applicationId });

    if (!session_id || !applicationId) {
      return res.status(400).json({
        success: false,
        message: "Session ID and Application ID are required"
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("✅ Stripe session retrieved:", session.id);
    console.log("Payment status:", session.payment_status);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: "Payment not completed"
      });
    }

    // Get metadata from session
    const { 
      applicationId: metaAppId, 
      tuitionId, 
      studentEmail, 
      tutorEmail, 
      amount 
    } = session.metadata;

    console.log("📦 Metadata:", { metaAppId, tuitionId, studentEmail, tutorEmail, amount });

    // Check if payment already exists
    const existingPayment = await paymentsCollections.findOne({ 
      transactionId: session.payment_intent 
    });

    if (existingPayment) {
      console.log("⚠️ Payment already recorded:", existingPayment);
      return res.json({
        success: true,
        message: "Payment already processed",
        payment: existingPayment
      });
    }

    // 1. Update application status to 'approved'
    await applicationCollections.updateOne(
      { _id: new ObjectId(metaAppId) },
      { 
        $set: { 
          status: 'approved',
          paymentStatus: 'paid',
          paidAt: new Date(),
          transactionId: session.payment_intent
        } 
      }
    );
    console.log("✅ Application updated");

    // 2. Update tuition status
    await tuitionCollections.updateOne(
      { _id: new ObjectId(tuitionId) },
      { 
        $set: { 
          status: 'approved',
          tutorEmail: tutorEmail,
          approvedAt: new Date(),
          paymentCompleted: true
        } 
      }
    );
    console.log("✅ Tuition updated");

    // 3. Reject all other pending applications for this tuition
    await applicationCollections.updateMany(
      {
        tuitionId: tuitionId,
        _id: { $ne: new ObjectId(metaAppId) },
        status: "pending"
      },
      {
        $set: {
          status: 'rejected',
          rejectedReason: 'Another tutor was selected',
          updatedAt: new Date()
        }
      }
    );
    console.log("✅ Other applications rejected");

    // 4. Record payment
    const paymentRecord = {
      studentEmail,
      tutorEmail,
      tuitionId,
      applicationId: metaAppId,
      amount: parseFloat(amount),
      transactionId: session.payment_intent,
      paymentMethod: 'card',
      status: 'completed',
      paymentDate: new Date(),
      createdAt: new Date()
    };

    const result = await paymentsCollections.insertOne(paymentRecord);
    console.log("✅ Payment recorded:", result.insertedId);

    res.json({
      success: true,
      message: "Payment processed successfully",
      payment: {
        ...paymentRecord,
        _id: result.insertedId
      }
    });

  } catch (error) {
    console.error("❌ Payment success error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message
    });
  }
});

// GET payment status by application
app.get("/payment-status/:applicationId", async (req, res) => {
  try {
    const applicationId = req.params.applicationId;

    const payment = await paymentsCollections.findOne({ 
      applicationId 
    });

    res.json({
      success: true,
      data: payment || null
    });

  } catch (error) {
    console.error("❌ Get payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment status"
    });
  }
});

// ================= UPDATE USER STATUS BY EMAIL =================
app.put("/api/update-user-status", async (req, res) => {
  try {
    const { email, status } = req.body;

    console.log("📤 Update request:", { email, status });

    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email is required",
      });
    }

    if (status && !["active", "blocked"].includes(status)) {
      return res.status(400).send({
        success: false,
        message: "Status must be 'active' or 'blocked'",
      });
    }

    const result = await userCollections.updateOne(
      { email: email },
      {
        $set: {
          status: status || "active",
          updatedAt: new Date(),
        },
      },
    );

    console.log("✅ Update result:", result);

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    res.send({
      success: true,
      message: `User status updated to ${status}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Update status error:", error);
    res.status(500).send({
      success: false,
      message: "Failed to update status",
      error: error.message,
    });
  }
});

// ================= HEALTH CHECK =================
app.get("/health-check", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date(),
    collections: {
      users: !!userCollections,
      donations: !!donationCollections,
      payments: !!paymentsCollections,
      tuitions: !!tuitionCollections,
      applications: !!applicationCollections,
    },
  });
});
// ================= PUBLIC TUITIONS API FOR HOME PAGE =================

// ================= GET ALL TUITIONS FOR ADMIN =================
app.get("/all-tuitions", async (req, res) => {
  try {
    console.log("📢 Fetching all tuitions for admin dashboard...");
    
    // Check if tuitionCollections exists
    if (!tuitionCollections) {
      console.error("❌ tuitionCollections is not initialized");
      return res.status(500).json([]);
    }

    // Get ALL tuitions - সবগুলো tuition দেখাবে (pending, approved, rejected)
    const tuitions = await tuitionCollections
      .find({})  // কোন filter নেই - সবগুলো ডকুমেন্ট
      .sort({ createdAt: -1 }) // Latest first
      .toArray(); // সবগুলো আনুন, limit না দিয়ে
    
    console.log(`✅ Found ${tuitions.length} tuitions for admin`);
    console.log("Status breakdown:", {
      pending: tuitions.filter(t => t.status === 'pending').length,
      approved: tuitions.filter(t => t.status === 'approved').length,
      rejected: tuitions.filter(t => t.status === 'rejected').length,
      completed: tuitions.filter(t => t.status === 'completed').length
    });
    
    // Return the array directly
    res.json(tuitions);
    
  } catch (error) {
    console.error("❌ Get all tuitions error:", error);
    res.status(500).json([]);
  }
});

// Alternative: GET All Tuitions with pagination (optional)
app.get("/public-tuitions", async (req, res) => {
  try {
    const { page = 1, limit = 20, subject, location } = req.query;
    
    const filter = { 
      isActive: true, 
      status: "pending" 
    };
    
    // Add filters if provided
    if (subject) {
      filter.subject = { $regex: subject, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tuitions = await tuitionCollections
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    const total = await tuitionCollections.countDocuments(filter);
    
    res.json({
      success: true,
      data: tuitions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("❌ Get public tuitions error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch tuitions" 
    });
  }
});

// ================= TUTOR APPLICATIONS APIs =================

// GET Tutor's Applications
app.get("/tutor-applications", async (req, res) => {
  try {
    const tutorEmail = req.query.tutorEmail;
    
    console.log("📧 Fetching applications for tutor:", tutorEmail);
    
    if (!tutorEmail) {
      return res.status(400).json({
        success: false,
        message: "Tutor email is required"
      });
    }
    
    // Find all applications by this tutor
    const applications = await applicationCollections
      .find({ tutorEmail })
      .sort({ appliedAt: -1 })
      .toArray();
    
    console.log(`✅ Found ${applications.length} applications`);
    
    // Get tuition details for each application
    const applicationsWithDetails = await Promise.all(
      applications.map(async (app) => {
        try {
          const tuition = await tuitionCollections.findOne(
            { _id: new ObjectId(app.tuitionId) },
            { 
              projection: { 
                subject: 1, 
                class: 1, 
                budget: 1, 
                location: 1, 
                daysPerWeek: 1,
                timeSlot: 1,
                studentName: 1,
                studentEmail: 1
              } 
            }
          );
          
          return { 
            ...app, 
            tuition: tuition || { 
              subject: "Unknown", 
              class: "N/A", 
              budget: 0,
              location: "N/A" 
            } 
          };
        } catch (err) {
          console.error("Error fetching tuition details:", err);
          return { 
            ...app, 
            tuition: { 
              subject: "Unknown", 
              class: "N/A", 
              budget: 0,
              location: "N/A" 
            } 
          };
        }
      })
    );
    
    res.json({
      success: true,
      data: applicationsWithDetails,
      count: applications.length
    });
    
  } catch (error) {
    console.error("❌ Get tutor applications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications",
      error: error.message
    });
  }
});

// UPDATE Tutor Application (Edit)
app.put("/tutor-applications/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID"
      });
    }
    
    // Check if application exists
    const application = await applicationCollections.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }
    
    // Can only edit pending applications
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Cannot edit approved or rejected application"
      });
    }
    
    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.tuitionId;
    delete updateData.tutorEmail;
    delete updateData.status;
    delete updateData.appliedAt;
    
    updateData.updatedAt = new Date();
    
    const result = await applicationCollections.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    // Get updated application
    const updatedApplication = await applicationCollections.findOne({ 
      _id: new ObjectId(id) 
    });
    
    res.json({
      success: true,
      message: "Application updated successfully",
      data: updatedApplication
    });
    
  } catch (error) {
    console.error("❌ Update tutor application error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update application"
    });
  }
});

// DELETE Tutor Application
app.delete("/tutor-applications/:id", async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID"
      });
    }
    
    // Check if application exists
    const application = await applicationCollections.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }
    
    // Can only delete pending applications
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Cannot delete approved or rejected application"
      });
    }
    
    // Delete the application
    const result = await applicationCollections.deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    // Decrease application count in tuition
    await tuitionCollections.updateOne(
      { _id: new ObjectId(application.tuitionId) },
      { $inc: { applications: -1 } }
    );
    
    res.json({
      success: true,
      message: "Application deleted successfully"
    });
    
  } catch (error) {
    console.error("❌ Delete tutor application error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete application"
    });
  }
});

// GET Tutor's Ongoing Tuitions (Approved)
app.get("/tutor-ongoing-tuitions", async (req, res) => {
  try {
    const tutorEmail = req.query.tutorEmail;
    
    if (!tutorEmail) {
      return res.status(400).json({
        success: false,
        message: "Tutor email is required"
      });
    }
    
    // Find all approved tuitions where this tutor is assigned
    const tuitions = await tuitionCollections
      .find({ 
        tutorEmail: tutorEmail,
        status: 'approved',
        isActive: true 
      })
      .sort({ approvedAt: -1 })
      .toArray();
    
    res.json({ 
      success: true, 
      data: tuitions,
      count: tuitions.length
    });
    
  } catch (error) {
    console.error("❌ Get ongoing tuitions error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch tuitions" 
    });
  }
});

// GET Tutor's Revenue
app.get("/tutor-revenue", async (req, res) => {
  try {
    const tutorEmail = req.query.tutorEmail;
    
    if (!tutorEmail) {
      return res.status(400).json({
        success: false,
        message: "Tutor email is required"
      });
    }
    
    // Find all payments made to this tutor
    const payments = await paymentsCollections
      .find({ tutorEmail })
      .sort({ paymentDate: -1 })
      .toArray();
    
    // Get tuition details for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        try {
          const tuition = await tuitionCollections.findOne(
            { _id: new ObjectId(payment.tuitionId) },
            { projection: { subject: 1, class: 1, studentName: 1 } }
          );
          
          return { 
            ...payment, 
            tuitionSubject: tuition?.subject || "Unknown",
            tuitionClass: tuition?.class || "N/A",
            studentName: tuition?.studentName || payment.studentEmail
          };
        } catch (err) {
          return { 
            ...payment, 
            tuitionSubject: "Unknown",
            tuitionClass: "N/A",
            studentName: payment.studentEmail
          };
        }
      })
    );
    
    // Calculate statistics
    const totalEarnings = paymentsWithDetails.reduce((sum, p) => sum + (p.amount || 0), 0);
    const thisMonth = paymentsWithDetails
      .filter(p => {
        const date = new Date(p.paymentDate);
        const now = new Date();
        return date.getMonth() === now.getMonth() && 
               date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    res.json({ 
      success: true, 
      data: paymentsWithDetails,
      stats: {
        totalEarnings,
        thisMonth,
        totalPayments: paymentsWithDetails.length
      }
    });
    
  } catch (error) {
    console.error("❌ Get tutor revenue error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch revenue" 
    });
  }
});

// Check if tutor already applied for a tuition
app.get("/check-application", async (req, res) => {
  try {
    const { tuitionId, tutorEmail } = req.query;
    
    if (!tuitionId || !tutorEmail) {
      return res.status(400).json({
        success: false,
        message: "Tuition ID and Tutor Email are required"
      });
    }
    
    const application = await applicationCollections.findOne({
      tuitionId,
      tutorEmail
    });
    
    res.json({ 
      success: true,
      exists: !!application,
      application: application || null
    });
    
  } catch (error) {
    console.error("❌ Check application error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to check application" 
    });
  }
});

// server.js - Add these routes

// GET All Payments for Admin
app.get("/all-payments", async (req, res) => {
  try {
    const payments = await paymentsCollections
      .find({})
      .sort({ paymentDate: -1 })
      .toArray();
    
    // Get tuition details for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        if (payment.tuitionId) {
          const tuition = await tuitionCollections.findOne(
            { _id: new ObjectId(payment.tuitionId) },
            { projection: { subject: 1, class: 1 } }
          );
          return { 
            ...payment, 
            tuitionSubject: tuition?.subject,
            tuitionClass: tuition?.class 
          };
        }
        return payment;
      })
    );
    
    res.json({
      success: true,
      data: paymentsWithDetails,
      count: payments.length
    });
  } catch (error) {
    console.error("❌ Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments"
    });
  }
});

// DELETE User by Email (Admin only)
app.delete("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;
    
    const result = await userCollections.deleteOne({ email });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user"
    });
  }
});
// ================= ADMIN TUITION MANAGEMENT =================

// GET applications for a specific tuition
app.get("/tuition-applications/:tuitionId", async (req, res) => {
  try {
    const tuitionId = req.params.tuitionId;
    
    const applications = await applicationCollections
      .find({ tuitionId })
      .sort({ appliedAt: -1 })
      .toArray();
    
    res.json({
      success: true,
      data: applications,
      count: applications.length
    });
  } catch (error) {
    console.error("❌ Get tuition applications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications"
    });
  }
});

// ================= START SERVER =================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📚 Database: missionscic11DB`);
  console.log(
    `📦 Collections: user, donationRequests, payments, tuitions, applications`,
  );
  console.log(`🔗 Health Check: http://localhost:${port}/health-check`);
});

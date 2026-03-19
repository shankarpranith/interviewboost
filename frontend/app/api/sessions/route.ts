import ReactMarkdown from "react-markdown";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma"; // Make sure this path matches your setup!
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    // 1. Get the actual logged-in user's ID from Clerk
    const { userId } = await auth();
    
    // 2. Security check: If they aren't logged in, block the save
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 3. Get the interview data sent from your frontend
    const data = await req.json();

    // 4. Save to the database using the Session model
    const savedSession = await prisma.session.create({
      data: {
        // Using fallbacks (||) so the database never crashes from missing data
        role: data.role || "Unknown Role", 
        experience: data.experienceLevel || data.experience || "Not specified", 
        userId: userId, // Real Clerk User ID
        feedback: data.feedback || "Pending", // Update this if your AI generates feedback at the end!
      }
    });

    // 5. Tell the frontend it was a success!
    return NextResponse.json({ success: true, session: savedSession });

  } catch (error) {
    // If anything goes wrong, log it and send a 500 failure code
    console.error("Database Save Error:", error);
    return NextResponse.json(
      { error: "Failed to save session to database." }, 
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    // 1. Get the actual logged-in user's ID from Clerk
    const { userId } = await auth();
    
    // 2. Security check: If they aren't logged in, block the fetch
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 3. Ask Prisma to find all sessions that belong to this specific user
    const sessions = await prisma.session.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc', // This puts the newest interviews at the top of the list!
      },
    });

    // 4. Send the data back to your frontend History page
    return NextResponse.json(sessions);

  } catch (error) {
    console.error("Database Fetch Error:", error);
    return new NextResponse("Internal Error fetching history", { status: 500 });
  }
}
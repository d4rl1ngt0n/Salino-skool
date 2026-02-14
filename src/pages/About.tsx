const About = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">About Salino GmbH</h1>
        <p className="text-gray-600">
          A comprehensive learning and community platform designed to help you grow your skills and connect with like-minded professionals.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-8 shadow-sm">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Our Mission</h2>
          <p className="text-gray-700 leading-relaxed">
            At Salino GmbH, we believe in empowering individuals and businesses through education and community. 
            Our platform provides access to high-quality courses, resources, and a supportive network of learners 
            and experts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-2">📚 Classroom</h3>
              <p className="text-sm text-gray-700">Access to comprehensive courses covering various topics from marketing to business strategy</p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-2">👥 Community</h3>
              <p className="text-sm text-gray-700">Connect with other members, share insights, and learn together</p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-2">📅 Calendar</h3>
              <p className="text-sm text-gray-700">Stay updated with upcoming events, workshops, and meetings</p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 mb-2">🏆 Leaderboards</h3>
              <p className="text-sm text-gray-700">Track your progress and compete with other members</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Get Started</h2>
          <p className="text-gray-700 leading-relaxed">
            Whether you're just starting your journey or looking to advance your skills, Salino GmbH provides 
            the tools and community you need to succeed. Explore our courses, engage with the community, and 
            start your learning journey today.
          </p>
        </section>

        <section className="pt-6 border-t border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
          <p className="text-gray-700">
            For questions or support, please reach out through the platform or contact our support team.
          </p>
        </section>
      </div>
    </div>
  )
}

export default About

# DSS Wearable

DSS Wearable is a mobile application being developed as part of the CSE3CAP Capstone Project by the FusionFive team. The project aims to develop a mobile application that connects with compatible wearable devices and provides users with access to real-time wearable data, notifications and meaningful insights.

## Project Goals

The main goals of DSS Wearable are to:

- Connect the mobile application with compatible wearable devices.
- Receive and display wearable sensor data in a user-friendly interface.
- Provide notifications and event-based alerts based on wearable metrics.
- Securely manage user accounts and user data.
- Provide historical visualisation of wearable metrics.
- Support multiple wearable devices.
- Provide a reliable and user-friendly mobile experience.
- Follow appropriate security practices throughout development.

## Technology Stack

The current development environment includes:

- React Native – Mobile application framework
- Expo – Development and application tooling
- JavaScript / TypeScript – Programming languages
- Firebase / Firestore – Authentication, backend services and cloud data storage
- Bluetooth Low Energy (BLE) – Wearable connectivity and sensor data
- NFC – Wearable/device identification and pairing functionality
- GitHub – Source control and collaborative development

## Libraries and Tools

The project uses a range of libraries and development tools to support application development, connectivity, authentication, data handling and user interface functionality.

Current tools and technologies include:

- React Native
- Expo
- Expo Go
- JavaScript
- TypeScript
- Firebase
- Firestore
- Bluetooth Low Energy (BLE)
- NFC
- GitHub

Additional libraries and technologies are documented in the project's technical documentation.

## Project Structure

The repository currently contains the following main components:

- `src/` – Application source code
- `src/app/` – Application screens and navigation
- `src/components/` – Reusable user interface components
- `src/connectivity/` – Bluetooth, NFC and wearable connectivity functionality
- `assets/` – Images and other project assets
- `scripts/` – Development and Firebase-related scripts
- `app.json` – Expo application configuration
- `package.json` – Project dependencies and configuration
- `tsconfig.json` – TypeScript configuration
- `.gitignore` – Files and directories excluded from version control

## Current Development Status

The project is currently in active development. A functional Android build has been implemented and tested, with core application functionality integrated.

### Currently implemented

- User registration and secure authentication
- Email/password authentication
- Google authentication
- User sign-out
- Firebase integration
- Firestore cloud data storage
- Bluetooth Low Energy (BLE) connectivity
- NFC functionality
- Wearable/device detection
- Real-time wearable metric display
- Heart-rate metric processing
- Metric history and visualisation
- Support for multiple wearable devices
- Data export to CSV
- Notifications based on metric thresholds
- Accessibility and user preference features
- Light/dark interface themes
- Multi-language support

### Notifications

Notification functionality has been implemented using Expo notifications.

The application can evaluate wearable metrics against defined thresholds and trigger a phone notification when a threshold condition is met.

For example:

- A heart-rate value below a configured threshold can trigger a notification.

Thresholds and notification behaviour may be refined during further development and testing.

### Current testing status

The Android application has been successfully compiled and tested using a physical Android device.

Bluetooth and NFC functionality requires compatible physical hardware and cannot be fully tested using a standard emulator.

iOS compatibility is also being tested separately using an appropriate macOS/Xcode development environment.

Further testing and refinement will continue across the remaining project sprints.

## Security

Security is an important consideration throughout the development of DSS Wearable. The team is using security guidance based on the OWASP Mobile Application Security Verification Standard (MASVS) and the Essential Eight security framework.

Security considerations include:

- Secure user authentication
- Protection of sensitive user data
- Secure network communication
- Appropriate handling of wearable/device data
- Avoiding unnecessary exposure of sensitive information
- Appropriate Firebase/Firestore security rules
- Secure handling of application configuration and credentials

## Team

DSS Wearable is being developed by FusionFive as part of the CSE3CAP Capstone Project.

Team members:

- Ali Mhanna
- Tanish Sudan
- Edris Nezrabi
- Caleb Weir
- Jacob Biggs

## Project Development

Development is managed using an iterative Scrum approach. The team uses Jira to plan and track sprint tasks and GitHub for source control and collaborative development.

Development is being completed incrementally, with team members contributing to areas including:

- Application development
- User interface
- Authentication
- Firebase and Firestore
- Bluetooth and NFC connectivity
- Wearable metric processing
- Data storage and visualisation
- Notifications
- Testing and quality assurance

The project will continue to be refined and tested across the remaining sprints, with additional functionality and improvements being incorporated as required.- Protection of sensitive user data
- Secure network communication
- Appropriate handling of wearable/device data
- Avoiding unnecessary exposure of sensitive information

# Team

DSS Wearable is being developed by **FusionFive** as part of the CSE3CAP Capstone Project.
Team members:

- Caleb Weir
- Tanish Sudan
- Jacob Biggs
- Edris Nezrabi
- Ali Mhanna


## Project Development

Development is managed using an iterative Scrum approach. The team uses Jira to plan and track sprint tasks and GitHub for source control and collaborative development.
The project will continue to be developed and refined across the remaining sprints, with testing and integration occurring as core functionality is implemented.

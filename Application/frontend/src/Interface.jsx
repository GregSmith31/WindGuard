import { useEffect, useState } from "react";
import axios from "axios";
import './style.css'; // Ensure to import the CSS file

const inputData = {
    "WindSpeed": "",
    "WindDirAbs": "",
    "WindDirRel": "",
    "Pitch": "",
    "GenRPM": "",
    "RotorRPM": "",
    "EnvirTemp": "",
    "NacelTemp": "",
    "GearOilTemp": "",
    "GearBearTemp": "",
    "GenPh1Temp": "",
    "GenPh2Temp": "",
    "GenPh3Temp": "",
    "GenBearTemp": ""
};
const orderedKeys = [
    "WindSpeed", "WindDirAbs", "WindDirRel", "Pitch",
    "GenRPM", "RotorRPM", "EnvirTemp", "NacelTemp",
    "GearOilTemp", "GearBearTemp", "GenPh1Temp",
    "GenPh2Temp", "GenPh3Temp", "GenBearTemp"
];
export default function Interface({ onRotorRPMChange, onPredictionChange }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [inputs, setInputs] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const [submittedValues, setSubmittedValues] = useState(null);
    const [predictedPower, setPredictedPower] = useState(null);
    const [modalType, setModalType] = useState('userEntry');
    const [currentTimestamp, setCurrentTimestamp] = useState(null);
    const [isTimestampInitialized, setIsTimestampInitialized] = useState(false);
    const [positionDifferences, setPositionDifferences] = useState([]);
    const [positionDifferencesMLP, setPositionDifferencesMLP] = useState([]);
    const [activeTab, setActiveTab] = useState('linear');
    const [requestController, setRequestController] = useState(null);


    const handleButtonClick = (buttonType) => {
        setModalOpen(true);
        setInputs({});
        setErrorMessage("");
        setModalType(buttonType);
    };

    const closeModal = () => {
        setModalOpen(false);
        setErrorMessage("")
    };

    const handleInputChange = (key, value) => {
        setInputs(prevInputs => Object.assign({}, prevInputs, {
            [key]: value
        }));
    };

    const handleSubmit = () => {
        if (requestController) {
            requestController.abort(); // Cancel previous request
        }
    
        const controller = new AbortController();
        setRequestController(controller); // Store the new controller
    
        const hasErrors = Object.keys(inputData).some(key => {
            const value = inputs[key] || "";
            return value === '' || isNaN(value);
        });
    
        if (hasErrors) {
            setErrorMessage("Please ensure all fields are filled and inputs are numeric only.");
        } else {
            const numericInputs = orderedKeys.reduce((acc, key) => {
                if (inputs.hasOwnProperty(key)) {
                    acc[key] = parseFloat(inputs[key]);
                }
                return acc;
            }, {});
            console.log(numericInputs);
            onRotorRPMChange(numericInputs);
    
            axios.post("http://localhost:8080/predictui", numericInputs, { signal: controller.signal })
                .then(response => {
                    setSubmittedValues(numericInputs);
                    setPredictedPower(response.data);
                    onPredictionChange(response.data);
                    console.log(response.data);
                })
                .catch(error => {
                    if (error.name === "AbortError") {
                        console.log("Previous request aborted");
                    } else {
                        console.error("Error sending data:", error);
                    }
                });
    
            closeModal();
            setInputs({});
            setErrorMessage("");
        }
    };
    

    useEffect(() => {
        let interval;
        if (isTimestampInitialized) {
            interval = setInterval(() => {
                setCurrentTimestamp(prevTimestamp => {
                    const newTimestamp = new Date(prevTimestamp.getTime() + 6000);
                    return newTimestamp;
                });
            }, 1000);
        }
        

        return () => clearInterval(interval); // Cleanup on unmount
    }, [isTimestampInitialized]);

    const handleBreakdownClick = async () => {
        if (requestController) {
            requestController.abort(); // Cancel previous request
            setIsTimestampInitialized(false)
        }
    
        const controller = new AbortController();
        setRequestController(controller); // Store the new controller
    
        setModalOpen(false);
        const response = await axios.get("http://localhost:8080/api/breakdown");
        const data = response.data;
    
        for (let row of data) {
            if (controller.signal.aborted){setIsTimestampInitialized(false); break}; // Stop the loop if aborted
            const timestamp = new Date(row.Timestamps);
            setCurrentTimestamp(timestamp);
            setIsTimestampInitialized(true);
    
            const numericInputs = {
                WindSpeed: row.WindSpeed,
                WindDirAbs: row.WindDirAbs,
                WindDirRel: row.WindDirRel,
                Pitch: row.Pitch,
                GenRPM: row.GenRPM,
                RotorRPM: row.RotorRPM,
                EnvirTemp: row.EnvirTemp,
                NacelTemp: row.NacelTemp,
                GearOilTemp: row.GearOilTemp,
                GearBearTemp: row.GearBearTemp,
                GenPh1Temp: row.GenPh1Temp,
                GenPh2Temp: row.GenPh2Temp,
                GenPh3Temp: row.GenPh3Temp,
                GenBearTemp: row.GenBearTemp
            };
            
            onRotorRPMChange(numericInputs);
    
            await axios.post("http://localhost:8080/predictui", numericInputs, { signal: controller.signal })
                .then(response => {
                    setSubmittedValues(numericInputs);
                    setPredictedPower(response.data);
                    onPredictionChange(response.data);
                    setPositionDifferences(response.data.position_differences);
                    setPositionDifferencesMLP(response.data.position_differences_mlp);
                })
                .catch(error => {
                    if (error.name === "AbortError") {
                        console.log("Previous request aborted");
                    } else {
                        console.error("Error sending data:", error);
                    }
                });
    
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds per row
        }
        setIsTimestampInitialized(false);
    };
    

    const handleFileUpload = (event) => {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                const lines = text.split('\n').map(line => line.trim()).filter(line => line); // Trim and filter empty lines
                const headers = lines[0].split(',').map(header => header.trim());

                const expectedHeaders = [
                    "Timestamps", "WindSpeed", "StdDevWindSpeed", "WindDirAbs", "WindDirRel",
                    "Power", "MaxPower", "MinPower", "StdDevPower", "AvgRPow",
                    "Pitch", "GenRPM", "RotorRPM", "EnvirTemp", "NacelTemp",
                    "GearOilTemp", "GearBearTemp", "GenTemp", "GenPh1Temp",
                    "GenPh2Temp", "GenPh3Temp", "GenBearTemp"
                ];
                console.log(headers);
                

                // Validate headers
                if (JSON.stringify(headers).includes( JSON.stringify(expectedHeaders))) {
                    console.log("File uploaded successfully:", file);
                    closeModal();

                    // Loop through each row after the header
                    for (let i = 1; i < lines.length; i++) {
                        const currentRow = lines[i].split(',').map(value => value.trim());

                        // Assuming that Timestamps is the first column
                        const timestamp = new Date(currentRow[0]);
                        setCurrentTimestamp(timestamp);
                        setIsTimestampInitialized(true);

                        const numericInputs = {};
                        headers.forEach((header, index) => {
                            numericInputs[header] = parseFloat(currentRow[index]);
                        });

                        // Send the data to the server
                        await axios.post("http://localhost:8080/predictui", numericInputs)
                            .then(response => {
                                console.log("Response from server:", response.data);
                                setSubmittedValues(numericInputs);
                                setPredictedPower(response.data);
                                onPredictionChange(response.data);
                                setPositionDifferences(response.data.position_differences);
                                setPositionDifferencesMLP(response.data.position_differences_mlp);
                            })
                            .catch(error => {
                                console.error("Error sending data:", error);
                            });
                        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds per row
                    }
                } else {
                    setErrorMessage("Invalid file format. Please ensure the file has the correct headers.");
                }
            };

            reader.readAsText(file);
        }
    };

    const downloadTemplate = () => {
        const link = document.createElement('a');
        link.href = '/Template.csv';
        link.setAttribute('download', 'Template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatTimestamp = (date) => {
        if (!date) return '';
        return date.toLocaleString(); // Format to local date string
    };

    return (
        <>

            <div id="interface">    
            <div id="hudBar">
                <button className="modern-btn" onClick={() => handleButtonClick('userEntry')}>User Entry</button>
                <button className="modern-btn" onClick={handleBreakdownClick}>Breakdown Demo</button>
                <button className="modern-btn" onClick={() => handleButtonClick('uploadFile')}>Upload File</button>
            </div>

            {modalOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close" onClick={closeModal}>&times;</span>
                        <h2>{modalType === 'userEntry' ? "User Entry" : "File Upload"}</h2>
                        {modalType === 'userEntry' ? (
                            <>
                                {Object.keys(inputData).map(key => (
                                    <div key={key} className="input-group">
                                        <label className="input-label">
                                            {key}
                                            {/* Add units based on the key */}
                                            {key === "WindSpeed" && " (m/s)"}
                                            {key === "WindDirAbs" && " (°)"}
                                            {key === "WindDirRel" && " (°)"}
                                            {key === "Pitch" && " (°)"}
                                            {key === "GenRPM" && " (rev/min)"}
                                            {key === "RotorRPM" && " (rev/min)"}
                                            {key === "EnvirTemp" && " (°C)"}
                                            {key === "NacelTemp" && " (°C)"}
                                            {key === "GearOilTemp" && " (°C)"}
                                            {key === "GearBearTemp" && " (°C)"}
                                            {key === "GenPh1Temp" && " (°C)"}
                                            {key === "GenPh2Temp" && " (°C)"}
                                            {key === "GenPh3Temp" && " (°C)"}
                                            {key === "GenBearTemp" && " (°C)"}
                                        </label>
                                        <input
                                            type="number"
                                            className="text-input"
                                            value={inputs[key] || ''}
                                            onChange={(e) => handleInputChange(key, e.target.value)}
                                        />
                                    </div>
                                ))}
                                <button className="submit-btn" onClick={handleSubmit}>Submit</button>
                                {errorMessage && <p className="error-message">{errorMessage}</p>}
                            </>
                        ) : (
                            <>
                                <p>Upload a file (CSV,XLSX, or JSON)
                                    <span className="tooltip">
                                        <span className="tooltip-icon">?</span>
                                        <span className="tooltip-text">
                                            <div>Please note the input data should follow the format below with the parameters the names of the column headers.</div>
                                            <img src=".\Images/TurbineDataInputs.png" alt="React Image" />
                                        </span>
                                    </span>
                                </p>
                                <input
                                    type="file"
                                    accept=".csv, .xlsx, .json"
                                    onChange={handleFileUpload}
                                    className="file-input"
                                />
                                {errorMessage && <p className="error-message">{errorMessage}</p>}
                                <button className="download-template-btn" onClick={downloadTemplate}>
                                    Download Template
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {submittedValues && (
                <>
                    {currentTimestamp && (
                        <div className="timestamp-display">
                            <h2>{formatTimestamp(currentTimestamp)}</h2> {/* Display formatted timestamp */}
                        </div>
                    )}
                    <div className="submitted-values-panel">
                        <h3>Current Sensor Readings</h3>
                        <ul>
                            {Object.entries(submittedValues).map(([key, value]) => (
                                <li key={key}>
                                    <strong>{key}:</strong> {value}
                                    {/* Add units based on the key */}
                                    {key === "WindSpeed" && " (m/s)"}
                                    {key === "WindDirAbs" && " (°)"}
                                    {key === "WindDirRel" && " (°)"}
                                    {key === "Pitch" && " (°)"}
                                    {key === "GenRPM" && " (rev/min)"}
                                    {key === "RotorRPM" && " (rev/min)"}
                                    {key === "EnvirTemp" && " (°C)"}
                                    {key === "NacelTemp" && " (°C)"}
                                    {key === "GearOilTemp" && " (°C)"}
                                    {key === "GearBearTemp" && " (°C)"}
                                    {key === "GenPh1Temp" && " (°C)"}
                                    {key === "GenPh2Temp" && " (°C)"}
                                    {key === "GenPh3Temp" && " (°C)"}
                                    {key === "GenBearTemp" && " (°C)"}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="predicted-power-panel">
                        <div className="tab-buttons">
                            <button onClick={() => setActiveTab('linear')} className={activeTab === 'linear' ? 'active' : ''}>
                                Linear Regression
                            </button>
                            <button onClick={() => setActiveTab('mlp')} className={activeTab === 'mlp' ? 'active' : ''}>
                                MLP Regression
                            </button>
                        </div>

                        {activeTab === 'linear' ? (
                            <>
                                <h2>Predicted Power (kW)</h2>
                                <ul>
                                    {predictedPower.predicted_power_output_linear}
                                </ul>
                            </>
                        ) : (
                            <>
                                <h2>Predicted Power (kW)</h2>
                                <ul>
                                    {predictedPower.predicted_power_output_mlp}
                                </ul>
                            </>
                        )}
                    </div>
                </>
            )}


            {predictedPower && (
                <>

                    <div className="coefficient-rank-panel">
                        <div className="tab-buttons">
                            <button onClick={() => setActiveTab('linear')} className={activeTab === 'linear' ? 'active' : ''}>
                                Linear Regression
                            </button>
                            <button onClick={() => setActiveTab('mlp')} className={activeTab === 'mlp' ? 'active' : ''}>
                                MLP Regression
                            </button>
                        </div>


                        {activeTab === 'linear' ? (
                            <>
                                <h3>Coefficient Rankings (Linear)</h3>
                                <ul>
                                    {predictedPower.global_coefficients.map(([name, value], index) => {
                                        const positionDiff = positionDifferences.find(([posName]) => posName === name);
                                        const diffValue = positionDiff ? positionDiff[1] : 0;

                                        return (
                                            <li key={index}>
                                                <strong>{name}:</strong> 
                                                {diffValue > 0 ? (
                                                    <span style={{ color: 'green' }}>↑ {diffValue}</span> // Show difference with green arrow
                                                ) : diffValue < 0 ? (
                                                    <span style={{ color: 'red' }}>↓ {Math.abs(diffValue)}</span> // Show negative difference with red arrow
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                                <h2>Normalised Kendall Tau Distance</h2>
                                <ul>
                                    {predictedPower.normalised_kendall_tau_linear}
                                </ul>
                            </>
                        ) : (
                            <>
                                <h3>Coefficient Rankings (MLP)</h3>
                                <ul>
                                    {predictedPower.global_coefficients.map(([name, value], index) => {
                                        const positionDiff = positionDifferencesMLP.find(([posName]) => posName === name);
                                        const diffValue = positionDiff ? positionDiff[1] : 0;

                                        return (
                                            <li key={index}>
                                                <strong>{name}:</strong> 
                                                {diffValue > 0 ? (
                                                    <span style={{ color: 'green' }}>↑ {diffValue}</span>
                                                ) : diffValue < 0 ? (
                                                    <span style={{ color: 'red' }}>↓ {Math.abs(diffValue)}</span>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                                <h2>Normalised Kendall Tau Distance</h2>
                                <ul>
                                    {predictedPower.normalised_kendall_tau_mlp}
                                </ul>
                            </>
                        )}
                    </div>

                </>
            )}
            </div>
        </>
    );
}
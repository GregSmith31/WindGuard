from flask import Flask, jsonify,  render_template, request
from flask_cors import CORS
import pickle
from sklearn.preprocessing import StandardScaler
import numpy as np
from scipy.stats import kendalltau
from lime.lime_tabular import LimeTabularExplainer
import pandas as pd
app = Flask(__name__)
cors = CORS(app, origins='*')

model = pickle.load(open('model2.pkl', 'rb') )
mlp_model = pickle.load(open('mlp_model.pkl', 'rb') )


@app.route('/predictui', methods=['POST'])
def predictUI():
    try:
        data = request.get_json(force=True)

        #print(data)
        
        int_features = [
            float(data['WindSpeed']),
            float(data['WindDirAbs']),
            float(data['WindDirRel']),
            float(data['Pitch']),
            float(data['GenRPM']),
            float(data['RotorRPM']),
            float(data['EnvirTemp']),
            float(data['NacelTemp']),
            float(data['GearOilTemp']),
            float(data['GearBearTemp']),
            float(data['GenPh1Temp']),
            float(data['GenPh2Temp']),
            float(data['GenPh3Temp']),
            float(data['GenBearTemp'])
        ]
        with open('scaler.pkl', 'rb') as f:
            scaler = pickle.load(f)
        mlp_scaled = scaler.transform([int_features])

        # Predicting using the model
        prediction = model.predict([int_features])
        mlp_prediction = mlp_model.predict(mlp_scaled)
        output = prediction[0]
        mlp_output = mlp_prediction[0]
        
        import numpy as np

        # Convert to a list for better readability
        coef_list = model.coef_



        feature_names = [
            "WindSpeed", "WindDirAbs", "WindDirRel", "Pitch", 
            "GenRPM", "RotorRPM", "EnvirTemp", "NacelTemp", 
            "GearOilTemp", "GearBearTemp", "GenPh1Temp", 
            "GenPh2Temp", "GenPh3Temp", "GenBearTemp"
        ]

        

        model_coeffs = pd.DataFrame({"Feature": feature_names, "Coefficient": model.coef_})
        coefficients = model_coeffs.sort_values(by='Coefficient', ascending=False)
        # print(coefficients)
        '''
        LOCAL EXPLANATION Attempt
        '''

        #LINEAR
        # ----------------------------------------------------------------------------------------------------------------------------------------------
        #print(int_features)
        #print(model.coef_)
        contributions = int_features * model.coef_
        contribution_list = [(name, contribution) for name, contribution in zip(feature_names, contributions)]
        #print(contribution_list)
        contribution_list.sort(key=lambda x: x[1], reverse=True)    
        max_contribution = max(contribution for name, contribution in contribution_list)
        min_contribution = min(contribution for name, contribution in contribution_list)

        normalized_contribution_list = [
            (name, (contribution - min_contribution) / (max_contribution - min_contribution) if max_contribution > min_contribution else 0)
            for name, contribution in contribution_list
        ]
        # print("Normalized Contributions:")
        # for name, normalized_value in normalized_contribution_list:
        #     print(f"{name}: {normalized_value:.4f}")

        # ------------------------------------------------------------------------------------------------------------------------------------------------
        #MLP
        # ------------------------------------------------------------------------------------------------------------------------------------------------
        
        mlp_dundalkSample_df = pd.read_csv('6 Months Dundalk Turbine.csv')  # Replace with your actual training data file


        mlp_X = mlp_dundalkSample_df[['WindSpeed', 'WindDirAbs', 'WindDirRel', 'Pitch', 'GenRPM', 'RotorRPM',
                                    'EnvirTemp', 'NacelTemp', 'GearOilTemp', 'GearBearTemp',
                                    'GenPh1Temp', 'GenPh2Temp', 'GenPh3Temp', 'GenBearTemp']]
        # print(mlp_scaled[0])
        # Scale the training data
        mlp_X_scaled = scaler.transform(mlp_X)
        feature_names = set(mlp_X.columns.tolist())
        # Initialize the LIME explainer
        explainer = LimeTabularExplainer(training_data=mlp_X_scaled,
                                        feature_names=mlp_X.columns.tolist(),
                                        mode='regression')
        
        exp = explainer.explain_instance(data_row=mlp_scaled[0], 
                                        predict_fn=mlp_model.predict,
                                        num_features=len(int_features))
        # print("here")

        # Get contributions as a list
        local_contributions = exp.as_list()
        # print("Local Contributions:")
        # for feature, contribution in local_contributions:
        #     print(f"{feature}: {abs(contribution):.4f}")

        mlp_ranking_list = sorted(local_contributions, key=lambda x: abs(x[1]), reverse=True)


        # print(mlp_ranking_list)

        # ------------------------------------------------------------------------------------------------------------------------------------------------

        '''
        GLOBAL EXPLANATION ATTEMPT
        '''

        

        

        # Create ranking lists
        local_ranking = [name for name, _ in normalized_contribution_list]
        local_ranking_mlp = [next((name for name in feature_names if name in feature), feature) for feature, _ in mlp_ranking_list]
        global_ranking = coefficients['Feature'].tolist()
        
        # print(local_ranking_mlp)
        # print(global_ranking)
        # print("LOCAL RANK LINEAR")
        # print(local_ranking)
        # print("LOCAL RANK MLP")
        # print(local_ranking_mlp)
        # Calculate position difference
        position_differences = {}
        position_differences_mlp = {}
        local_positions = {name: index for index, name in enumerate(local_ranking)}
        local_positions_mlp = {name: index for index, name in enumerate(local_ranking_mlp)}
        global_positions = {name: index for index, name in enumerate(global_ranking)}


        print(local_positions)
        # Assuming local_positions is already defined
        first_item = next(iter(local_positions.items()))
        print(first_item) 
        # print(local_positions_mlp)

        # print(global_positions)

        
        #LINEAR
        for feature in local_positions.keys():
            local_pos = local_positions[feature]
            global_pos = global_positions.get(feature, None)
            if global_pos is not None:
                position_difference = global_pos -  local_pos 
                position_differences[feature] = position_difference

        # Sort by absolute position difference
        sorted_position_differences = sorted(position_differences.items(), key=lambda x: abs(x[1]), reverse=True)


        # for feature, diff in sorted_position_differences:
        #     print(f"Feature: {feature}, Position Difference: {diff}")
        first_posDiff = sorted_position_differences[0] if sorted_position_differences else None
        # print(first_posDiff)
        # print(sorted_position_differences)


        # MLP 
        for feature in local_positions_mlp.keys():
            local_pos = local_positions_mlp[feature]
            global_pos = global_positions.get(feature, None)
            if global_pos is not None:
                position_difference = global_pos -  local_pos 
                position_differences_mlp[feature] = position_difference

        # Sort by absolute position difference
        sorted_position_differences_mlp = sorted(position_differences_mlp.items(), key=lambda x: abs(x[1]), reverse=True)
        first_item_mlp = next(iter(local_positions_mlp.items()))
        #print(first_item_mlp) 

        # print("Position Differences:")
        # for feature, diff in sorted_position_differences_mlp:
        #     print(f"Feature: {feature}, Position Difference: {diff}")

        # print(sorted_position_differences_mlp)
        

        #Filter out Environment Variables
        filtered_position_local = [
            (feature) for feature in local_positions
            if feature not in ['WindSpeed', 'EnvirTemp','WindDirAbs','WindDirRel']
        ]
        print(local_positions)
        print(filtered_position_local[0])

        filtered_position_local_mlp = [
            (feature) for feature in local_positions_mlp
            if feature not in ['WindSpeed', 'EnvirTemp','WindDirAbs','WindDirRel']
        ]
        print(local_positions_mlp)
        print(filtered_position_local_mlp[0])


        '''
        KENDALL TAU DISTANCE
        '''

        #LINEAR
        tau, p_value = kendalltau(local_ranking, global_ranking)
        # Normalize the Kendall Tau output
        normalized_tau = (tau + 1) / 2
        # print("Kendall Tau Distance:", tau)
        # print("Normalized Kendall Tau Distance:", normalized_tau)

        #MLP
        tau_mlp, p_value = kendalltau(local_ranking_mlp, global_ranking)
        # Normalize the Kendall Tau output
        normalized_tau_mlp = (tau_mlp + 1) / 2
        # print("Kendall Tau Distance MLP:", tau_mlp)
        #print("Normalized Kendall Tau Distance MLP:", normalized_tau_mlp)


        maintenance_score = np.dot(model.coef_, int_features) 

        model_intercept = model.intercept_

        maintenance_threshold = 80  


        #print(coefficients)
        coefficients_tuples = [(row['Feature'], np.float64(row['Coefficient'])) for index, row in coefficients.iterrows()]

        #print(coefficients_tuples)

        maintenance_needed = maintenance_score > maintenance_threshold
        coefficients_json = coefficients.to_dict(orient='list')
        
        # print("POWER OUTPUTS:" + str(output))
        return jsonify({
            "predicted_power_output_linear": (output),
            "predicted_power_output_mlp": (mlp_output),
            "maintenance_score": round(float(maintenance_score), 2),
            "normalised_kendall_tau_linear": normalized_tau,
            "normalised_kendall_tau_mlp": normalized_tau_mlp,
            "global_coefficients": coefficients_tuples,
            "maintenance_needed": maintenance_needed.item(),  
            "message": "Maintenance required." if maintenance_needed else "All systems normal.",
            "position_differences": sorted_position_differences,
            "position_differences_mlp": sorted_position_differences_mlp,
            "leadLocal_Variable_Linear": filtered_position_local[0],
            "leadLocal_Variable_MLP": filtered_position_local_mlp[0],


        })
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred.", "details": str(e)}), 500
# Breakdown Demo
import pandas as pd

@app.route('/api/breakdown', methods=['GET'])
def get_breakdown_data():
    df = pd.read_csv('BreakdownExample.csv')
    return jsonify(df.to_dict(orient='records'))





if __name__ == "__main__":
    app.run(debug=True, port=8080)